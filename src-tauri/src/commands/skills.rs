use std::path::PathBuf;
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
    let response = gw.send_request("skills.status", Some(serde_json::json!({"agentId": agent_id}))).await?;
    Ok(response.get("skills").cloned().unwrap_or(serde_json::Value::Array(vec![])))
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
    params: serde_json::Value,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    gw.send_request("skills.update", Some(params)).await
}

#[tauri::command]
pub async fn skills_bins(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    let response = gw.send_request("skills.bins", None).await?;
    Ok(response.get("bins").cloned().unwrap_or(serde_json::Value::Array(vec![])))
}

#[tauri::command]
pub async fn skills_file_get(
    file_path: String,
) -> Result<String, AppError> {
    let path = PathBuf::from(&file_path);
    if !path.exists() {
        return Err(AppError::Other(format!("Skill file not found: {}", file_path)));
    }
    let content = tokio::fs::read_to_string(&path).await?;
    Ok(content)
}

#[tauri::command]
pub async fn skills_file_set(
    file_path: String,
    content: String,
) -> Result<(), AppError> {
    let path = PathBuf::from(&file_path);
    if !path.exists() {
        return Err(AppError::Other(format!("Skill file not found: {}", file_path)));
    }
    tokio::fs::write(&path, content).await?;
    Ok(())
}
