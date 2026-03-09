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
                        let mut rx = gw.subscribe();

                        let challenge_result = tokio::time::timeout(
                            Duration::from_secs(5),
                            async {
                                loop {
                                    match rx.recv().await {
                                        Ok(evt) if evt.event == "connect.challenge" => {
                                            return Ok(evt);
                                        }
                                        Ok(_) => continue,
                                        Err(broadcast::error::RecvError::Closed) => {
                                            return Err("broadcast closed before challenge");
                                        }
                                        Err(broadcast::error::RecvError::Lagged(n)) => {
                                            tracing::warn!("Lagged {n} while waiting for challenge");
                                            continue;
                                        }
                                    }
                                }
                            },
                        )
                        .await;

                        let challenge = match challenge_result {
                            Ok(Ok(evt)) => evt,
                            Ok(Err(e)) => {
                                tracing::error!("Challenge wait failed: {e}");
                                continue;
                            }
                            Err(_) => {
                                tracing::error!("Timed out waiting for connect.challenge");
                                continue;
                            }
                        };

                        tracing::debug!("Received connect.challenge: {:?}", challenge.payload);

                        let connect_params = serde_json::json!({
                            "minProtocol": 3,
                            "maxProtocol": 3,
                            "client": {
                                "id": "cli",
                                "displayName": "OpenClaw Desktop",
                                "version": "0.1.0",
                                "platform": std::env::consts::OS,
                                "mode": "cli"
                            },
                            "role": "operator",
                            "scopes": ["operator.admin"],
                            "auth": {
                                "token": token
                            }
                        });

                        match gw.send_request("connect", Some(connect_params)).await {
                            Ok(hello) => {
                                tracing::info!("Gateway authenticated: {:?}", hello);
                                let _ = app_handle.emit("gateway:status", "connected");
                                backoff = Duration::from_secs(1);

                                let closed = gw.closed();
                                {
                                    let mut lock = client_clone.write().await;
                                    *lock = Some(gw);
                                }

                                loop {
                                    tokio::select! {
                                        result = rx.recv() => {
                                            match result {
                                                Ok(evt) => {
                                                    let event_name = format!("gw:{}", evt.event);
                                                    let _ = app_handle.emit(
                                                        &event_name,
                                                        evt.payload.clone(),
                                                    );
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
                                tracing::error!("Connect request failed: {e}");
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
