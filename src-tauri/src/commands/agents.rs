use std::path::PathBuf;
use tauri::State;
use crate::error::AppError;
use crate::state::AppState;

#[tauri::command]
pub async fn list_agents(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    let response = gw.send_request("agents.list", None).await?;
    let agents = response.get("agents").cloned().unwrap_or(serde_json::Value::Array(vec![]));
    Ok(agents)
}

#[tauri::command]
pub async fn get_agent_files(
    state: State<'_, AppState>,
    agent_id: String,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    let response = gw.send_request("agents.files.list", Some(serde_json::json!({"agentId": agent_id}))).await?;
    let files = response.get("files").cloned().unwrap_or(serde_json::Value::Array(vec![]));
    Ok(files)
}

#[tauri::command]
pub async fn get_agent_file(
    state: State<'_, AppState>,
    agent_id: String,
    filename: String,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    let response = gw.send_request("agents.files.get", Some(serde_json::json!({"agentId": agent_id, "name": filename}))).await?;
    let content = response
        .pointer("/file/content")
        .cloned()
        .unwrap_or(serde_json::Value::String(String::new()));
    Ok(content)
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
        "name": filename,
        "content": content
    }))).await
}

async fn resolve_agent_workspace(state: &AppState, agent_id: &str) -> Result<String, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    let response = gw.send_request("agents.files.list", Some(serde_json::json!({"agentId": agent_id}))).await?;
    let workspace = response
        .get("workspace")
        .and_then(|v| v.as_str())
        .ok_or_else(|| AppError::Other("Cannot resolve agent workspace".into()))?;
    Ok(workspace.to_string())
}

#[tauri::command]
pub async fn get_agent_mcp_config(
    state: State<'_, AppState>,
    agent_id: String,
) -> Result<String, AppError> {
    let workspace = resolve_agent_workspace(&state, &agent_id).await?;
    let path = PathBuf::from(&workspace).join("config").join("mcporter.json");
    if !path.exists() {
        return Ok("{}".to_string());
    }
    let content = tokio::fs::read_to_string(&path).await?;
    Ok(content)
}

#[tauri::command]
pub async fn set_agent_mcp_config(
    state: State<'_, AppState>,
    agent_id: String,
    content: String,
) -> Result<(), AppError> {
    let workspace = resolve_agent_workspace(&state, &agent_id).await?;
    let config_dir = PathBuf::from(&workspace).join("config");
    tokio::fs::create_dir_all(&config_dir).await?;
    let path = config_dir.join("mcporter.json");
    tokio::fs::write(&path, content).await?;
    Ok(())
}
