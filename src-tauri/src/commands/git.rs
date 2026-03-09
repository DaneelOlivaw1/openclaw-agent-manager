use crate::error::AppError;
use crate::git::{CommitInfo, DiffInfo};

#[tauri::command]
pub async fn git_log(
    workspace_path: String,
    limit: Option<usize>,
) -> Result<Vec<CommitInfo>, AppError> {
    tokio::task::spawn_blocking(move || crate::git::log(&workspace_path, limit.unwrap_or(50)))
        .await
        .map_err(|e| AppError::Other(e.to_string()))?
}

#[tauri::command]
pub async fn git_diff(
    workspace_path: String,
    old_commit_id: Option<String>,
    new_commit_id: Option<String>,
) -> Result<Vec<DiffInfo>, AppError> {
    tokio::task::spawn_blocking(move || {
        crate::git::diff_commits(
            &workspace_path,
            old_commit_id.as_deref(),
            new_commit_id.as_deref(),
        )
    })
    .await
    .map_err(|e| AppError::Other(e.to_string()))?
}

#[tauri::command]
pub async fn git_checkout(
    workspace_path: String,
    commit_id: String,
) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || crate::git::checkout_commit(&workspace_path, &commit_id))
        .await
        .map_err(|e| AppError::Other(e.to_string()))?
}
