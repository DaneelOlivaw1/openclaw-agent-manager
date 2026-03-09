use tauri::State;
use crate::error::AppError;
use crate::state::AppState;

#[tauri::command]
pub async fn chat_send(
    state: State<'_, AppState>,
    agent_id: String,
    message: String,
    session_key: Option<String>,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    let mut params = serde_json::json!({
        "agentId": agent_id,
        "message": message,
    });
    if let Some(key) = session_key {
        params["sessionKey"] = serde_json::Value::String(key);
    }
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
    run_id: String,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    gw.send_request("chat.abort", Some(serde_json::json!({"runId": run_id}))).await
}
