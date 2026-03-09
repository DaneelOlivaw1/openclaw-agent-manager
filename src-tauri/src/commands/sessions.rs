use tauri::State;
use crate::error::AppError;
use crate::state::AppState;

#[tauri::command]
pub async fn sessions_list(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    let response = gw.send_request("sessions.list", None).await?;
    Ok(response.get("sessions").cloned().unwrap_or(serde_json::Value::Array(vec![])))
}

#[tauri::command]
pub async fn sessions_resolve(
    state: State<'_, AppState>,
    session_key: String,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    gw.send_request("sessions.resolve", Some(serde_json::json!({"sessionKey": session_key}))).await
}

#[tauri::command]
pub async fn sessions_reset(
    state: State<'_, AppState>,
    session_key: String,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    gw.send_request("sessions.reset", Some(serde_json::json!({"sessionKey": session_key}))).await
}

#[tauri::command]
pub async fn sessions_delete(
    state: State<'_, AppState>,
    session_key: String,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    gw.send_request("sessions.delete", Some(serde_json::json!({"sessionKey": session_key}))).await
}
