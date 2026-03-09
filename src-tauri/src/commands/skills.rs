use tauri::State;
use crate::error::AppError;
use crate::state::AppState;

#[tauri::command]
pub async fn skills_status(
    state: State<'_, AppState>,
    agent_id: String,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    gw.send_request("skills.status", Some(serde_json::json!({"agentId": agent_id}))).await
}

#[tauri::command]
pub async fn skills_install(
    state: State<'_, AppState>,
    agent_id: String,
    skill_name: String,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    gw.send_request("skills.install", Some(serde_json::json!({"agentId": agent_id, "skillName": skill_name}))).await
}

#[tauri::command]
pub async fn skills_update(
    state: State<'_, AppState>,
    agent_id: String,
    params: serde_json::Value,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    let mut merged = params;
    if let Some(obj) = merged.as_object_mut() {
        obj.insert("agentId".to_string(), serde_json::Value::String(agent_id));
    }
    gw.send_request("skills.update", Some(merged)).await
}

#[tauri::command]
pub async fn skills_bins(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    gw.send_request("skills.bins", None).await
}
