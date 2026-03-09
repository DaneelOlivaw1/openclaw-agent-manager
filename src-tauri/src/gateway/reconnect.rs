use std::sync::Arc;
use std::time::Duration;

use tauri::Emitter;
use tokio::sync::{broadcast, RwLock};

use crate::gateway::client::GatewayClient;

pub struct ReconnectManager {
    url: String,
    token: String,
}

impl ReconnectManager {
    pub fn new(url: String, token: String) -> Self {
        Self { url, token }
    }

    pub fn start(
        self,
        app_handle: tauri::AppHandle,
    ) -> Arc<RwLock<Option<GatewayClient>>> {
        let client: Arc<RwLock<Option<GatewayClient>>> = Arc::new(RwLock::new(None));
        let client_clone = client.clone();
        let url = self.url;
        let token = self.token;

        tauri::async_runtime::spawn(async move {
            let mut backoff = Duration::from_secs(1);
            let max_backoff = Duration::from_secs(30);

            loop {
                tracing::info!("Connecting to gateway: {url}");
                let _ = app_handle.emit("gateway:status", "connecting");

                match GatewayClient::connect(&url).await {
                    Ok(gw) => {
                        match gw.handshake(&token).await {
                            Ok(_) => {
                                tracing::info!("Gateway connected and authenticated");
                                let _ = app_handle.emit("gateway:status", "connected");
                                backoff = Duration::from_secs(1);

                                let mut rx = gw.subscribe();
                                let closed = gw.closed();
                                {
                                    let mut lock = client_clone.write().await;
                                    *lock = Some(gw);
                                }

                                loop {
                                    tokio::select! {
                                        result = rx.recv() => {
                                            match result {
                                                Ok(bcast) => {
                                                    let event_name = format!("gw:{}", bcast.method);
                                                    let _ = app_handle.emit(&event_name, bcast.params.clone());
                                                }
                                                Err(broadcast::error::RecvError::Closed) => break,
                                                Err(broadcast::error::RecvError::Lagged(n)) => {
                                                    tracing::warn!("Broadcast lagged by {n} messages");
                                                }
                                            }
                                        }
                                        _ = closed.notified() => {
                                            tracing::warn!("Gateway connection closed");
                                            break;
                                        }
                                    }
                                }

                                {
                                    let mut lock = client_clone.write().await;
                                    if let Some(ref gw) = *lock {
                                        gw.fail_pending();
                                    }
                                    *lock = None;
                                }
                                let _ = app_handle.emit("gateway:status", "disconnected");
                            }
                            Err(e) => {
                                tracing::error!("Handshake failed: {e}");
                            }
                        }
                    }
                    Err(e) => {
                        tracing::error!("Connection failed: {e}");
                    }
                }

                let _ = app_handle.emit("gateway:status", "reconnecting");
                tracing::info!("Reconnecting in {}s", backoff.as_secs());
                tokio::time::sleep(backoff).await;
                backoff = (backoff * 2).min(max_backoff);
            }
        });

        client
    }
}
