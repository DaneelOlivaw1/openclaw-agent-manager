mod commands;
mod error;
mod gateway;
mod git;
mod state;

use std::path::PathBuf;

use state::AppState;
use tauri::Manager;

use gateway::device_auth::DeviceIdentity;

fn openclaw_home() -> Option<PathBuf> {
    std::env::var("HOME")
        .ok()
        .map(|h| PathBuf::from(h).join(".openclaw"))
        .filter(|p| p.is_dir())
}

struct GatewayConfig {
    url: String,
    token: String,
    device_identity: Option<DeviceIdentity>,
}

fn resolve_gateway_config() -> GatewayConfig {
    if let Ok(token) = std::env::var("OPENCLAW_GATEWAY_TOKEN") {
        if !token.is_empty() {
            let url = std::env::var("OPENCLAW_GATEWAY_URL")
                .unwrap_or_else(|_| "ws://127.0.0.1:18789".to_string());
            tracing::info!("Using gateway token from OPENCLAW_GATEWAY_TOKEN env var");
            return GatewayConfig { url, token, device_identity: None };
        }
    }

    let home = match openclaw_home() {
        Some(h) => h,
        None => {
            tracing::warn!("~/.openclaw not found, gateway auth will be empty");
            return GatewayConfig {
                url: "ws://127.0.0.1:18789".to_string(),
                token: String::new(),
                device_identity: None,
            };
        }
    };

    let mut url = "ws://127.0.0.1:18789".to_string();
    let mut config_token: Option<String> = None;
    let mut is_local_gateway = true;

    let config_path = home.join("openclaw.json");
    if let Ok(raw) = std::fs::read_to_string(&config_path) {
        if let Ok(cfg) = serde_json::from_str::<serde_json::Value>(&raw) {
            if let Some(port) = cfg.pointer("/gateway/port").and_then(|v| v.as_u64()) {
                url = format!("ws://127.0.0.1:{port}");
            }
            if let Some(t) = cfg.pointer("/gateway/auth/token").and_then(|v| v.as_str()) {
                config_token = Some(t.to_string());
            }
            if let Some(mode) = cfg.pointer("/gateway/mode").and_then(|v| v.as_str()) {
                is_local_gateway = mode == "local";
            }
        }
    }

    let url = std::env::var("OPENCLAW_GATEWAY_URL").unwrap_or(url);

    let device_identity = gateway::device_auth::load_device_identity(&home);

    if let Some(token) = config_token {
        if is_local_gateway {
            tracing::info!("Using gateway auth token from {}", config_path.display());
            return GatewayConfig { url, token, device_identity };
        }
    }

    let device_auth_path = home.join("identity").join("device-auth.json");
    if let Ok(raw) = std::fs::read_to_string(&device_auth_path) {
        if let Ok(da) = serde_json::from_str::<serde_json::Value>(&raw) {
            if let Some(token) = da.pointer("/tokens/operator/token").and_then(|v| v.as_str()) {
                tracing::info!("Using device-auth token from {}", device_auth_path.display());
                return GatewayConfig { url, token: token.to_string(), device_identity };
            }
        }
    }

    tracing::warn!("No gateway token found in env, device-auth, or config");
    GatewayConfig { url, token: String::new(), device_identity: None }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter("openclaw_agent_manager=debug")
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let handle = app.handle().clone();
            let config = resolve_gateway_config();
            let manager = gateway::reconnect::ReconnectManager::new(
                config.url,
                config.token,
                config.device_identity,
            );
            let client = manager.start(handle);
            app.manage(AppState { gateway: client });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Gateway
            commands::gateway::gateway_status,
            // Agents
            commands::agents::list_agents,
            commands::agents::get_agent_files,
            commands::agents::get_agent_file,
            commands::agents::set_agent_file,
            commands::agents::get_agent_mcp_config,
            commands::agents::set_agent_mcp_config,
            // Config
            commands::config::config_get,
            commands::config::config_patch,
            commands::config::config_schema,
            // Chat
            commands::chat::chat_send,
            commands::chat::chat_history,
            commands::chat::chat_abort,
            // Sessions
            commands::sessions::sessions_list,
            commands::sessions::sessions_resolve,
            commands::sessions::sessions_reset,
            commands::sessions::sessions_delete,
            // Cron
            commands::cron::cron_list,
            commands::cron::cron_status,
            commands::cron::cron_add,
            commands::cron::cron_update,
            commands::cron::cron_remove,
            commands::cron::cron_run,
            commands::cron::cron_runs,
            // Skills
            commands::skills::skills_status,
            commands::skills::skills_install,
            commands::skills::skills_update,
            commands::skills::skills_bins,
            commands::skills::skills_file_get,
            commands::skills::skills_file_set,
            // Git
            commands::git::git_log,
            commands::git::git_diff,
            commands::git::git_checkout,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
