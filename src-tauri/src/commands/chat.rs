use tauri::State;
use crate::error::AppError;
use crate::state::AppState;

#[tauri::command]
pub async fn chat_send(
    state: State<'_, AppState>,
    session_key: String,
    message: String,
    idempotency_key: String,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    let params = serde_json::json!({
        "sessionKey": session_key,
        "message": message,
        "idempotencyKey": idempotency_key,
    });
    gw.send_request("chat.send", Some(params)).await
}

#[tauri::command]
pub async fn chat_history(
    state: State<'_, AppState>,
    session_key: String,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    gw.send_request("chat.history", Some(serde_json::json!({"sessionKey": session_key}))).await
}

#[tauri::command]
pub async fn chat_abort(
    state: State<'_, AppState>,
    session_key: String,
    run_id: Option<String>,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    let mut params = serde_json::json!({"sessionKey": session_key});
    if let Some(rid) = run_id {
        params["runId"] = serde_json::Value::String(rid);
    }
    gw.send_request("chat.abort", Some(params)).await
}
