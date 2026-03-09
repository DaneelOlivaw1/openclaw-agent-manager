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
    pending: Arc<DashMap<String, oneshot::Sender<GatewayResponse>>>,
    broadcast_tx: broadcast::Sender<GatewayBroadcast>,
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
        let pending: Arc<DashMap<String, oneshot::Sender<GatewayResponse>>> =
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
                        match serde_json::from_str::<IncomingMessage>(&text) {
                            Ok(IncomingMessage::Response(resp)) => {
                                if let Some((_, sender)) = pending_clone.remove(&resp.id) {
                                    let _ = sender.send(resp);
                                }
                            }
                            Ok(IncomingMessage::Broadcast(bcast)) => {
                                let _ = broadcast_tx_clone.send(bcast);
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
                    Ok(_) => {} // ignore ping/pong/binary
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
        let req = GatewayRequest {
            id: id.clone(),
            method: method.to_string(),
            params,
        };

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

        if let Some(err) = resp.error {
            return Err(AppError::Gateway(err.message));
        }

        resp.result
            .ok_or_else(|| AppError::Gateway("Empty result".into()))
    }

    pub fn subscribe(&self) -> broadcast::Receiver<GatewayBroadcast> {
        self.broadcast_tx.subscribe()
    }

    pub async fn handshake(&self, token: &str) -> Result<serde_json::Value, AppError> {
        self.send_request(
            "connect",
            Some(serde_json::json!({
                "token": token,
                "role": "admin"
            })),
        )
        .await
    }

    pub fn closed(&self) -> Arc<Notify> {
        self.closed.clone()
    }

    pub fn fail_pending(&self) {
        self.pending.clear();
    }
}
