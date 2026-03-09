use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use tauri::Emitter;
use tokio::sync::{broadcast, RwLock};

use crate::gateway::client::GatewayClient;
use crate::gateway::device_auth::{
    build_device_auth_payload, public_key_raw_base64url, sign_payload, DeviceIdentity,
};

pub struct ReconnectManager {
    url: String,
    token: String,
    device_identity: Option<DeviceIdentity>,
}

impl ReconnectManager {
    pub fn new(url: String, token: String, device_identity: Option<DeviceIdentity>) -> Self {
        Self { url, token, device_identity }
    }

    pub fn start(
        self,
        app_handle: tauri::AppHandle,
    ) -> Arc<RwLock<Option<GatewayClient>>> {
        let client: Arc<RwLock<Option<GatewayClient>>> = Arc::new(RwLock::new(None));
        let client_clone = client.clone();
        let url = self.url;
        let token = self.token;
        let device_identity = self.device_identity;

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

                        let nonce = challenge
                            .payload
                            .as_ref()
                            .and_then(|p| p.get("nonce"))
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string());

                        let auth = serde_json::json!({
                            "token": token
                        });

                        let mut connect_params = serde_json::json!({
                            "minProtocol": 3,
                            "maxProtocol": 3,
                            "client": {
                                "id": "gateway-client",
                                "displayName": "OpenClaw Desktop",
                                "version": "0.1.0",
                                "platform": std::env::consts::OS,
                                "mode": "backend"
                            },
                            "role": "operator",
                            "scopes": ["operator.admin"],
                            "auth": auth
                        });

                        if let Some(ref di) = device_identity {
                            let signed_at_ms = SystemTime::now()
                                .duration_since(UNIX_EPOCH)
                                .unwrap()
                                .as_millis() as u64;

                            let payload = build_device_auth_payload(
                                &di.device_id,
                                "gateway-client",
                                "backend",
                                "operator",
                                &["operator.admin"],
                                signed_at_ms,
                                &token,
                                nonce.as_deref(),
                            );

                            let signature = sign_payload(&di.private_key_pem, &payload);
                            let public_key = public_key_raw_base64url(&di.public_key_pem);

                            let mut device = serde_json::json!({
                                "id": di.device_id,
                                "publicKey": public_key,
                                "signature": signature,
                                "signedAt": signed_at_ms
                            });
                            if let Some(ref n) = nonce {
                                device["nonce"] = serde_json::Value::String(n.clone());
                            }
                            connect_params["device"] = device;
                        }

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
