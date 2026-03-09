mod commands;
mod error;
mod gateway;
mod git;
mod state;

use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter("openclaw_desktop=debug")
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let handle = app.handle().clone();
            let manager = gateway::reconnect::ReconnectManager::new(
                "ws://127.0.0.1:18789".to_string(),
                "".to_string(),
            );
            let client = manager.start(handle);
            app.manage(AppState { gateway: client });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Agents
            commands::agents::list_agents,
            commands::agents::get_agent_files,
            commands::agents::get_agent_file,
            commands::agents::set_agent_file,
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
            // Git
            commands::git::git_log,
            commands::git::git_diff,
            commands::git::git_checkout,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
