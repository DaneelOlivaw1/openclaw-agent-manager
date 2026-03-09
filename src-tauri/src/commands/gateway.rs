use tauri::State;
use crate::state::AppState;

#[tauri::command]
pub async fn gateway_status(
    state: State<'_, AppState>,
) -> Result<String, String> {
    let lock = state.gateway.read().await;
    if lock.is_some() {
        Ok("connected".to_string())
    } else {
        Ok("disconnected".to_string())
    }
}
