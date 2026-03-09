use tauri::State;
use crate::error::AppError;
use crate::state::AppState;

#[tauri::command]
pub async fn config_get(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    gw.send_request("config.get", None).await
}

#[tauri::command]
pub async fn config_patch(
    state: State<'_, AppState>,
    base_hash: String,
    raw: String,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    gw.send_request("config.patch", Some(serde_json::json!({"baseHash": base_hash, "raw": raw}))).await
}

#[tauri::command]
pub async fn config_schema(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    gw.send_request("config.schema", None).await
}
