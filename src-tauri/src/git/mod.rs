use git2::{DiffOptions, IndexAddOption, Oid, Repository, Signature, Sort};
use serde::Serialize;
use std::path::Path;

use crate::error::AppError;

#[derive(Debug, Clone, Serialize)]
pub struct CommitInfo {
    pub id: String,
    pub message: String,
    pub timestamp: i64,
    pub author: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DiffInfo {
    pub filename: String,
    pub patch: String,
}

pub fn ensure_repo(workspace_path: &str) -> Result<Repository, AppError> {
    let path = Path::new(workspace_path);
    match Repository::open(path) {
        Ok(repo) => Ok(repo),
        Err(_) => {
            let repo = Repository::init(path).map_err(|e| AppError::Git(e.to_string()))?;
            {
                let sig = Signature::now("OpenClaw Desktop", "openclaw@local")
                    .map_err(|e| AppError::Git(e.to_string()))?;
                let mut index = repo.index().map_err(|e| AppError::Git(e.to_string()))?;
                index.write().map_err(|e| AppError::Git(e.to_string()))?;
                let tree_id = index
                    .write_tree()
                    .map_err(|e| AppError::Git(e.to_string()))?;
                let tree = repo
                    .find_tree(tree_id)
                    .map_err(|e| AppError::Git(e.to_string()))?;
                repo.commit(Some("HEAD"), &sig, &sig, "Initial commit", &tree, &[])
                    .map_err(|e| AppError::Git(e.to_string()))?;
            }
            Ok(repo)
        }
    }
}

pub fn commit_all(workspace_path: &str, message: &str) -> Result<String, AppError> {
    let repo = ensure_repo(workspace_path)?;
    let sig = Signature::now("OpenClaw Desktop", "openclaw@local")
        .map_err(|e| AppError::Git(e.to_string()))?;

    let mut index = repo.index().map_err(|e| AppError::Git(e.to_string()))?;
    index
        .add_all(["*"].iter(), IndexAddOption::DEFAULT, None)
        .map_err(|e| AppError::Git(e.to_string()))?;
    index.write().map_err(|e| AppError::Git(e.to_string()))?;

    let tree_id = index
        .write_tree()
        .map_err(|e| AppError::Git(e.to_string()))?;
    let tree = repo
        .find_tree(tree_id)
        .map_err(|e| AppError::Git(e.to_string()))?;

    let head = repo.head().map_err(|e| AppError::Git(e.to_string()))?;
    let parent = head
        .peel_to_commit()
        .map_err(|e| AppError::Git(e.to_string()))?;

    let oid = repo
        .commit(Some("HEAD"), &sig, &sig, message, &tree, &[&parent])
        .map_err(|e| AppError::Git(e.to_string()))?;

    Ok(oid.to_string())
}

pub fn log(workspace_path: &str, limit: usize) -> Result<Vec<CommitInfo>, AppError> {
    let repo = ensure_repo(workspace_path)?;
    let mut revwalk = repo.revwalk().map_err(|e| AppError::Git(e.to_string()))?;
    revwalk
        .push_head()
        .map_err(|e| AppError::Git(e.to_string()))?;
    revwalk
        .set_sorting(Sort::TIME)
        .map_err(|e| AppError::Git(e.to_string()))?;

    let mut commits = Vec::new();
    for oid_result in revwalk.take(limit) {
        let oid = oid_result.map_err(|e| AppError::Git(e.to_string()))?;
        let commit = repo
            .find_commit(oid)
            .map_err(|e| AppError::Git(e.to_string()))?;
        commits.push(CommitInfo {
            id: oid.to_string(),
            message: commit.message().unwrap_or("").to_string(),
            timestamp: commit.time().seconds(),
            author: commit.author().name().unwrap_or("unknown").to_string(),
        });
    }
    Ok(commits)
}

pub fn diff_commits(
    workspace_path: &str,
    old_commit_id: Option<&str>,
    new_commit_id: Option<&str>,
) -> Result<Vec<DiffInfo>, AppError> {
    let repo = ensure_repo(workspace_path)?;

    let new_commit = match new_commit_id {
        Some(id) => {
            let oid = Oid::from_str(id).map_err(|e| AppError::Git(e.to_string()))?;
            repo.find_commit(oid)
                .map_err(|e| AppError::Git(e.to_string()))?
        }
        None => repo
            .head()
            .and_then(|h| h.peel_to_commit())
            .map_err(|e| AppError::Git(e.to_string()))?,
    };

    let old_tree = match old_commit_id {
        Some(id) => {
            let oid = Oid::from_str(id).map_err(|e| AppError::Git(e.to_string()))?;
            let commit = repo
                .find_commit(oid)
                .map_err(|e| AppError::Git(e.to_string()))?;
            Some(commit.tree().map_err(|e| AppError::Git(e.to_string()))?)
        }
        None => new_commit.parent(0).ok().and_then(|p| p.tree().ok()),
    };

    let new_tree = new_commit
        .tree()
        .map_err(|e| AppError::Git(e.to_string()))?;

    let diff = repo
        .diff_tree_to_tree(
            old_tree.as_ref(),
            Some(&new_tree),
            Some(&mut DiffOptions::new()),
        )
        .map_err(|e| AppError::Git(e.to_string()))?;

    let mut diffs: Vec<DiffInfo> = Vec::new();
    diff.print(git2::DiffFormat::Patch, |delta, _hunk, line| {
        let filename = delta
            .new_file()
            .path()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();

        let content = std::str::from_utf8(line.content()).unwrap_or("");
        let prefix = match line.origin() {
            '+' => "+",
            '-' => "-",
            _ => " ",
        };

        if let Some(last) = diffs.last_mut() {
            if last.filename == filename {
                last.patch.push_str(prefix);
                last.patch.push_str(content);
                return true;
            }
        }
        diffs.push(DiffInfo {
            filename,
            patch: format!("{prefix}{content}"),
        });
        true
    })
    .map_err(|e| AppError::Git(e.to_string()))?;

    Ok(diffs)
}

pub fn checkout_commit(workspace_path: &str, commit_id: &str) -> Result<(), AppError> {
    let repo = ensure_repo(workspace_path)?;
    let oid = Oid::from_str(commit_id).map_err(|e| AppError::Git(e.to_string()))?;
    let commit = repo
        .find_commit(oid)
        .map_err(|e| AppError::Git(e.to_string()))?;

    repo.checkout_tree(commit.as_object(), None)
        .map_err(|e| AppError::Git(e.to_string()))?;
    repo.set_head_detached(oid)
        .map_err(|e| AppError::Git(e.to_string()))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_ensure_repo_creates_new() {
        let tmp = TempDir::new().unwrap();
        let path = tmp.path().to_str().unwrap();
        let repo = ensure_repo(path).unwrap();
        assert!(!repo.is_bare());
    }

    #[test]
    fn test_ensure_repo_opens_existing() {
        let tmp = TempDir::new().unwrap();
        let path = tmp.path().to_str().unwrap();
        ensure_repo(path).unwrap();
        // Second call should open, not reinit
        let repo = ensure_repo(path).unwrap();
        assert!(!repo.is_bare());
    }

    #[test]
    fn test_commit_and_log() {
        let tmp = TempDir::new().unwrap();
        let path = tmp.path().to_str().unwrap();
        ensure_repo(path).unwrap();

        std::fs::write(tmp.path().join("test.md"), "# Hello").unwrap();
        commit_all(path, "Add test.md").unwrap();

        let log_entries = log(path, 10).unwrap();
        assert!(log_entries.len() >= 2); // initial + our commit
        assert_eq!(log_entries[0].message, "Add test.md");
    }

    #[test]
    fn test_diff_commits() {
        let tmp = TempDir::new().unwrap();
        let path = tmp.path().to_str().unwrap();
        ensure_repo(path).unwrap();

        std::fs::write(tmp.path().join("file.txt"), "v1").unwrap();
        let id1 = commit_all(path, "v1").unwrap();

        std::fs::write(tmp.path().join("file.txt"), "v2").unwrap();
        let id2 = commit_all(path, "v2").unwrap();

        let diffs = diff_commits(path, Some(&id1), Some(&id2)).unwrap();
        assert!(!diffs.is_empty());
        assert_eq!(diffs[0].filename, "file.txt");
    }

    #[test]
    fn test_checkout_commit() {
        let tmp = TempDir::new().unwrap();
        let path = tmp.path().to_str().unwrap();
        ensure_repo(path).unwrap();

        std::fs::write(tmp.path().join("file.txt"), "original").unwrap();
        let id1 = commit_all(path, "original").unwrap();

        std::fs::write(tmp.path().join("file.txt"), "modified").unwrap();
        commit_all(path, "modified").unwrap();

        checkout_commit(path, &id1).unwrap();

        let content = std::fs::read_to_string(tmp.path().join("file.txt")).unwrap();
        assert_eq!(content, "original");
    }
}
