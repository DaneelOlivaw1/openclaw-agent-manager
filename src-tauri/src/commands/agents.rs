use tauri::State;
use crate::error::AppError;
use crate::state::AppState;

#[tauri::command]
pub async fn list_agents(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    gw.send_request("agents.list", None).await
}

#[tauri::command]
pub async fn get_agent_files(
    state: State<'_, AppState>,
    agent_id: String,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    gw.send_request("agents.files.list", Some(serde_json::json!({"agentId": agent_id}))).await
}

#[tauri::command]
pub async fn get_agent_file(
    state: State<'_, AppState>,
    agent_id: String,
    filename: String,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    gw.send_request("agents.files.get", Some(serde_json::json!({"agentId": agent_id, "filename": filename}))).await
}

#[tauri::command]
pub async fn set_agent_file(
    state: State<'_, AppState>,
    agent_id: String,
    filename: String,
    content: String,
    _workspace_path: Option<String>,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    gw.send_request("agents.files.set", Some(serde_json::json!({
        "agentId": agent_id,
        "filename": filename,
        "content": content
    }))).await
}
