use std::sync::Arc;
use std::time::Duration;

use dashmap::DashMap;
use futures_util::stream::SplitSink;
use futures_util::{SinkExt, StreamExt};
use tokio::sync::{broadcast, oneshot, Mutex, Notify};
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::{connect_async, MaybeTlsStream};
use uuid::Uuid;

use crate::error::AppError;
use crate::gateway::protocol::*;

type WsSink = SplitSink<
    tokio_tungstenite::WebSocketStream<MaybeTlsStream<tokio::net::TcpStream>>,
    Message,
>;

pub struct GatewayClient {
    sink: Arc<Mutex<WsSink>>,
    pending: Arc<DashMap<String, oneshot::Sender<ResponseFrame>>>,
    broadcast_tx: broadcast::Sender<EventFrame>,
    closed: Arc<Notify>,
    _reader_handle: tokio::task::JoinHandle<()>,
}

impl GatewayClient {
    pub async fn connect(url: &str) -> Result<Self, AppError> {
        let (ws_stream, _) = connect_async(url)
            .await
            .map_err(|e| AppError::Gateway(format!("Connection failed: {e}")))?;

        let (sink, mut stream) = ws_stream.split();
        let sink = Arc::new(Mutex::new(sink));
        let pending: Arc<DashMap<String, oneshot::Sender<ResponseFrame>>> =
            Arc::new(DashMap::new());
        let (broadcast_tx, _) = broadcast::channel(256);

        let pending_clone = pending.clone();
        let broadcast_tx_clone = broadcast_tx.clone();
        let closed = Arc::new(Notify::new());
        let closed_clone = closed.clone();

        let reader_handle = tokio::spawn(async move {
            while let Some(msg_result) = stream.next().await {
                match msg_result {
                    Ok(Message::Text(text)) => {
                        match serde_json::from_str::<IncomingFrame>(&text) {
                            Ok(IncomingFrame::Response(resp)) => {
                                if let Some((_, sender)) = pending_clone.remove(&resp.id) {
                                    let _ = sender.send(resp);
                                }
                            }
                            Ok(IncomingFrame::Event(evt)) => {
                                let _ = broadcast_tx_clone.send(evt);
                            }
                            Err(e) => {
                                tracing::warn!("Failed to parse WS message: {e}");
                                tracing::debug!("Raw message: {text}");
                            }
                        }
                    }
                    Ok(Message::Close(_)) => {
                        tracing::info!("WS close frame received");
                        break;
                    }
                    Ok(_) => {}
                    Err(e) => {
                        tracing::error!("WS read error: {e}");
                        break;
                    }
                }
            }
            tracing::info!("WS reader loop ended");
            closed_clone.notify_waiters();
        });

        Ok(Self {
            sink,
            pending,
            broadcast_tx,
            closed,
            _reader_handle: reader_handle,
        })
    }

    pub async fn send_request(
        &self,
        method: &str,
        params: Option<serde_json::Value>,
    ) -> Result<serde_json::Value, AppError> {
        let id = Uuid::new_v4().to_string();
        let req = RequestFrame::new(id.clone(), method.to_string(), params);

        let (tx, rx) = oneshot::channel();
        self.pending.insert(id.clone(), tx);

        let json = serde_json::to_string(&req)?;
        self.sink
            .lock()
            .await
            .send(Message::Text(json.into()))
            .await
            .map_err(|e| {
                self.pending.remove(&id);
                AppError::Gateway(format!("Send failed: {e}"))
            })?;

        let resp = tokio::time::timeout(Duration::from_secs(30), rx)
            .await
            .map_err(|_| {
                self.pending.remove(&id);
                AppError::Gateway(format!("Request timeout: {method}"))
            })?
            .map_err(|_| AppError::Gateway("Response channel closed".into()))?;

        if !resp.ok {
            return Err(AppError::Gateway(
                resp.error
                    .map(|e| e.message)
                    .unwrap_or_else(|| "unknown error".into()),
            ));
        }

        Ok(resp.payload.unwrap_or(serde_json::Value::Null))
    }

    pub fn subscribe(&self) -> broadcast::Receiver<EventFrame> {
        self.broadcast_tx.subscribe()
    }

    pub fn closed(&self) -> Arc<Notify> {
        self.closed.clone()
    }

    pub fn fail_pending(&self) {
        self.pending.clear();
    }
}
