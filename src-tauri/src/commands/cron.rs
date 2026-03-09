use tauri::State;
use crate::error::AppError;
use crate::state::AppState;

#[tauri::command]
pub async fn cron_list(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    let response = gw.send_request("cron.list", None).await?;
    Ok(response.get("jobs").cloned().unwrap_or(serde_json::Value::Array(vec![])))
}

#[tauri::command]
pub async fn cron_status(
    state: State<'_, AppState>,
    cron_id: String,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    gw.send_request("cron.status", Some(serde_json::json!({"cronId": cron_id}))).await
}

#[tauri::command]
pub async fn cron_add(
    state: State<'_, AppState>,
    params: serde_json::Value,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    gw.send_request("cron.add", Some(params)).await
}

#[tauri::command]
pub async fn cron_update(
    state: State<'_, AppState>,
    params: serde_json::Value,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    gw.send_request("cron.update", Some(params)).await
}

#[tauri::command]
pub async fn cron_remove(
    state: State<'_, AppState>,
    cron_id: String,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    gw.send_request("cron.remove", Some(serde_json::json!({"cronId": cron_id}))).await
}

#[tauri::command]
pub async fn cron_run(
    state: State<'_, AppState>,
    cron_id: String,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    gw.send_request("cron.run", Some(serde_json::json!({"cronId": cron_id}))).await
}

#[tauri::command]
pub async fn cron_runs(
    state: State<'_, AppState>,
    cron_id: String,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    let response = gw.send_request("cron.runs", Some(serde_json::json!({"cronId": cron_id}))).await?;
    Ok(response.get("entries").cloned().unwrap_or(serde_json::Value::Array(vec![])))
}
