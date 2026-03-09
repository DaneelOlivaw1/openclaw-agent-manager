# OpenClaw Desktop — Implementation Plan

**Date**: 2026-03-08
**Based on**: `2026-03-08-openclaw-desktop-design.md`
**Status**: Reviewed & Ready

---

## Phase 1: Project Scaffolding (Day 1)

**Goal**: Tauri v2 app boots, frontend renders, Rust backend compiles.

### Step 1.1 — Initialize Tauri v2 project

**Action**: Run `npm create tauri-app@latest` with React + TypeScript template in the project root.

**Verification**:
- `cargo build` succeeds in `src-tauri/`
- `npm run tauri dev` opens a window with the React template

**Files created**:
```
openclaw-desktop/
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── src/
│   │   ├── main.rs
│   │   └── lib.rs
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   └── vite-env.d.ts
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

### Step 1.2 — Configure Cargo.toml dependencies

**Action**: Add all required Rust crates to `src-tauri/Cargo.toml`:

```toml
[dependencies]
tauri = { version = "2", features = ["macos-private-api"] }
tauri-plugin-shell = "2"
tokio = { version = "1", features = ["full"] }
tokio-tungstenite = { version = "0.26", features = ["native-tls"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
json5 = "0.4"
uuid = { version = "1", features = ["v4"] }
anyhow = "1"
futures-util = "0.3"
git2 = "0.19"
thiserror = "2"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
```

**Verification**: `cargo check` succeeds.

### Step 1.3 — Configure frontend dependencies

**Action**: Install npm packages:

```bash
npm install zustand @uiw/react-md-editor react-router-dom@6
npm install -D tailwindcss @tailwindcss/vite
npx shadcn@latest init
```

Configure Tailwind v4 via `@tailwindcss/vite` plugin in `vite.config.ts`:
```ts
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

Create `src/index.css` with:
```css
@import "tailwindcss";
```

**Verification**: `npm run dev` renders styled content.

### Step 1.4 — Set up Rust module structure

**Action**: Create the module directory structure:

```
src-tauri/src/
├── main.rs          (entry point, unchanged)
├── lib.rs           (tauri::Builder setup, register commands)
├── state.rs         (AppState struct with gateway client handle)
├── error.rs         (thiserror-based error types → IPC-serializable)
├── gateway/
│   ├── mod.rs       (re-exports)
│   ├── client.rs    (GatewayClient struct, connect/send/recv)
│   ├── protocol.rs  (Request/Response/Broadcast serde types)
│   └── reconnect.rs (ReconnectManager with exponential backoff)
├── commands/
│   ├── mod.rs       (re-exports)
│   ├── agents.rs    (agent IPC commands)
│   ├── config.rs    (config IPC commands)
│   ├── chat.rs      (chat IPC commands)
│   ├── cron.rs      (cron IPC commands)
│   ├── sessions.rs  (sessions IPC commands)
│   └── skills.rs    (skills IPC commands)
└── git/
    └── mod.rs       (git2 operations)
```

Each file starts with minimal stubs. Example `state.rs`:
```rust
use std::sync::Arc;
use tokio::sync::RwLock;
use crate::gateway::client::GatewayClient;

pub struct AppState {
    pub gateway: Arc<RwLock<Option<GatewayClient>>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            gateway: Arc::new(RwLock::new(None)),
        }
    }
}
```

Example `error.rs`:
```rust
use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Gateway not connected")]
    NotConnected,
    #[error("Gateway error: {0}")]
    Gateway(String),
    #[error("Git error: {0}")]
    Git(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Serialization error: {0}")]
    Serde(#[from] serde_json::Error),
    #[error("{0}")]
    Other(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where S: serde::Serializer {
        serializer.serialize_str(&self.to_string())
    }
}
```

**lib.rs** wires it together:
```rust
mod commands;
mod error;
mod gateway;
mod git;
mod state;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter("openclaw_desktop=debug")
        .init();

    tauri::Builder::default()
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            commands::agents::list_agents,
            commands::agents::get_agent_files,
            commands::agents::get_agent_file,
            commands::agents::set_agent_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Verification**: `cargo check` succeeds with all modules present.

### Step 1.5 — Set up frontend routing shell

**Action**: Create React Router layout with sidebar navigation:

```
src/
├── App.tsx            (BrowserRouter + Routes)
├── layouts/
│   └── MainLayout.tsx (sidebar + main content area)
├── pages/
│   ├── Agents.tsx     (placeholder)
│   ├── AgentDetail.tsx(placeholder)
│   ├── Config.tsx     (placeholder)
│   ├── Cron.tsx       (placeholder)
│   └── Chat.tsx       (placeholder)
└── lib/
    └── tauri-api.ts   (typed invoke wrappers)
```

**App.tsx**:
```tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { MainLayout } from "./layouts/MainLayout";
import { Agents } from "./pages/Agents";
import { AgentDetail } from "./pages/AgentDetail";
import { Config } from "./pages/Config";
import { Cron } from "./pages/Cron";
import { Chat } from "./pages/Chat";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route index element={<Navigate to="/agents" replace />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/agents/:id" element={<AgentDetail />} />
          <Route path="/config" element={<Config />} />
          <Route path="/cron" element={<Cron />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/chat/:sessionKey" element={<Chat />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

Install shadcn Button + Sidebar components:
```bash
npx shadcn@latest add button sidebar
```

**Verification**: `npm run tauri dev` shows sidebar with nav links, each route renders placeholder.

### Step 1.6 — Stub `tauri-api.ts` with typed invoke wrappers

**Action**: Create `src/lib/tauri-api.ts`:
```ts
import { invoke } from "@tauri-apps/api/core";

// -- Agents --
export async function listAgents(): Promise<Agent[]> {
  return invoke("list_agents");
}

export async function getAgentFiles(agentId: string): Promise<string[]> {
  return invoke("get_agent_files", { agentId });
}

export async function getAgentFile(agentId: string, filename: string): Promise<string> {
  return invoke("get_agent_file", { agentId, filename });
}

export async function setAgentFile(agentId: string, filename: string, content: string): Promise<void> {
  return invoke("set_agent_file", { agentId, filename, content });
}

// Types
export interface Agent {
  id: string;
  name: string;
  model: string;
  workspace: string;
}
```

**Verification**: TypeScript compiles without errors.

### Phase 1 Completion Criteria
- [ ] `npm run tauri dev` opens window with sidebar navigation
- [ ] All Rust modules compile (`cargo check` clean)
- [ ] Frontend routes render placeholders
- [ ] `tauri-api.ts` types align with Rust command stubs

---

## Phase 2: Rust Backend — Gateway Client & Core Modules (Days 2-4)

**Goal**: Full WS client with reconnect, request/response matching, and event forwarding. All Rust backend modules operational.

### Step 2.1 — Gateway Protocol Types (`gateway/protocol.rs`)

**Action**: Define the complete wire protocol types for the OpenClaw Gateway.

```rust
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Outgoing request envelope
#[derive(Debug, Clone, Serialize)]
pub struct GatewayRequest {
    pub id: String,           // UUID v4
    pub method: String,       // e.g. "agents.list", "chat.send"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<Value>,
}

/// Incoming response envelope
#[derive(Debug, Clone, Deserialize)]
pub struct GatewayResponse {
    pub id: String,
    #[serde(default)]
    pub result: Option<Value>,
    #[serde(default)]
    pub error: Option<GatewayError>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct GatewayError {
    pub code: i32,
    pub message: String,
}

/// Server-push broadcast message (no `id`, has `method`)
#[derive(Debug, Clone, Deserialize)]
pub struct GatewayBroadcast {
    pub method: String,       // e.g. "chat"
    pub params: Value,
}

/// Union type for parsing incoming WS messages
#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
pub enum IncomingMessage {
    Response(GatewayResponse),
    Broadcast(GatewayBroadcast),
}

/// Connect handshake params
#[derive(Debug, Serialize)]
pub struct ConnectParams {
    pub token: String,
    pub role: String,        // "admin"
}

/// Chat send params
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatSendParams {
    pub agent_id: String,
    pub message: String,
    pub session_key: Option<String>,
}

/// Chat broadcast event payload
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatEvent {
    pub run_id: String,
    pub agent_id: String,
    pub state: String,       // "delta", "final", "error"
    #[serde(default)]
    pub text: Option<String>,
    #[serde(default)]
    pub message: Option<Value>,
    #[serde(default)]
    pub session_key: Option<String>,
}
```

**Verification**: `cargo check` passes, serde round-trip tests pass.

**Tests** (`gateway/protocol.rs` #[cfg(test)]):
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_response() {
        let json = r#"{"id":"abc","result":{"agents":[]}}"#;
        let msg: IncomingMessage = serde_json::from_str(json).unwrap();
        assert!(matches!(msg, IncomingMessage::Response(_)));
    }

    #[test]
    fn parse_broadcast() {
        let json = r#"{"method":"chat","params":{"runId":"r1","agentId":"a1","state":"delta","text":"hi"}}"#;
        let msg: IncomingMessage = serde_json::from_str(json).unwrap();
        assert!(matches!(msg, IncomingMessage::Broadcast(_)));
    }

    #[test]
    fn serialize_request() {
        let req = GatewayRequest {
            id: "test-id".into(),
            method: "agents.list".into(),
            params: None,
        };
        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains("agents.list"));
        assert!(!json.contains("params")); // skip_serializing_if
    }
}
```

### Step 2.2 — Gateway Client (`gateway/client.rs`)

**Action**: Implement the core WS client with request/response matching.

**Key design**:
- `GatewayClient` holds a `SplitSink` for sending and spawns a reader task
- Pending requests stored in `Arc<DashMap<String, oneshot::Sender<GatewayResponse>>>`
- `send_request()` creates a UUID, inserts a oneshot channel, sends the message, awaits the response with timeout
- Reader task parses `IncomingMessage`, routes responses to pending channels, forwards broadcasts to a `broadcast::Sender`

```rust
use std::sync::Arc;
use std::time::Duration;
use futures_util::{SinkExt, StreamExt};
use tokio::sync::{broadcast, oneshot, Mutex};
use tokio_tungstenite::{connect_async, tungstenite::Message};
use dashmap::DashMap;
use uuid::Uuid;
use crate::gateway::protocol::*;
use crate::error::AppError;

pub struct GatewayClient {
    sink: Arc<Mutex<SplitSink>>,
    pending: Arc<DashMap<String, oneshot::Sender<GatewayResponse>>>,
    broadcast_tx: broadcast::Sender<GatewayBroadcast>,
    reader_handle: tokio::task::JoinHandle<()>,
}

type SplitSink = futures_util::stream::SplitSink<
    tokio_tungstenite::WebSocketStream<
        tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>
    >,
    Message,
>;

impl GatewayClient {
    pub async fn connect(url: &str) -> Result<Self, AppError> {
        let (ws_stream, _) = connect_async(url)
            .await
            .map_err(|e| AppError::Gateway(e.to_string()))?;

        let (sink, mut stream) = ws_stream.split();
        let sink = Arc::new(Mutex::new(sink));
        let pending: Arc<DashMap<String, oneshot::Sender<GatewayResponse>>> =
            Arc::new(DashMap::new());
        let (broadcast_tx, _) = broadcast::channel(256);

        let pending_clone = pending.clone();
        let broadcast_tx_clone = broadcast_tx.clone();

        let reader_handle = tokio::spawn(async move {
            while let Some(Ok(msg)) = stream.next().await {
                if let Message::Text(text) = msg {
                    match serde_json::from_str::<IncomingMessage>(&text) {
                        Ok(IncomingMessage::Response(resp)) => {
                            if let Some((_, sender)) = pending_clone.remove(&resp.id) {
                                let _ = sender.send(resp);
                            }
                        }
                        Ok(IncomingMessage::Broadcast(bcast)) => {
                            let _ = broadcast_tx_clone.send(bcast);
                        }
                        Err(e) => {
                            tracing::warn!("Failed to parse WS message: {e}");
                        }
                    }
                }
            }
            tracing::info!("WS reader loop ended");
        });

        Ok(Self {
            sink,
            pending,
            broadcast_tx,
            reader_handle,
        })
    }

    /// Send a request and await matching response (30s timeout)
    pub async fn send_request(
        &self,
        method: &str,
        params: Option<serde_json::Value>,
    ) -> Result<serde_json::Value, AppError> {
        let id = Uuid::new_v4().to_string();
        let req = GatewayRequest {
            id: id.clone(),
            method: method.to_string(),
            params,
        };

        let (tx, rx) = oneshot::channel();
        self.pending.insert(id.clone(), tx);

        let json = serde_json::to_string(&req)?;
        self.sink
            .lock()
            .await
            .send(Message::Text(json.into()))
            .await
            .map_err(|e| AppError::Gateway(e.to_string()))?;

        let resp = tokio::time::timeout(Duration::from_secs(30), rx)
            .await
            .map_err(|_| {
                self.pending.remove(&id);
                AppError::Gateway(format!("Request timeout: {method}"))
            })?
            .map_err(|_| AppError::Gateway("Response channel closed".into()))?;

        if let Some(err) = resp.error {
            return Err(AppError::Gateway(err.message));
        }

        resp.result.ok_or_else(|| AppError::Gateway("Empty result".into()))
    }

    /// Subscribe to broadcast events
    pub fn subscribe(&self) -> broadcast::Receiver<GatewayBroadcast> {
        self.broadcast_tx.subscribe()
    }

    /// Perform the connect handshake
    pub async fn handshake(&self, token: &str) -> Result<serde_json::Value, AppError> {
        let params = ConnectParams {
            token: token.to_string(),
            role: "admin".to_string(),
        };
        self.send_request("connect", Some(serde_json::to_value(params)?)).await
    }
}
```

**Note**: Add `dashmap = "6"` to Cargo.toml.

**Verification**: `cargo check` passes. Unit test with mock WS server (see Step 2.3).

### Step 2.3 — Reconnect Manager (`gateway/reconnect.rs`)

**Action**: Wrap `GatewayClient` with auto-reconnect logic using exponential backoff.

```rust
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{RwLock, Notify};
use crate::gateway::client::GatewayClient;
use crate::error::AppError;

pub struct ReconnectManager {
    url: String,
    token: String,
    client: Arc<RwLock<Option<GatewayClient>>>,
    notify: Arc<Notify>,
}

impl ReconnectManager {
    pub fn new(url: String, token: String) -> Self {
        Self {
            url,
            token,
            client: Arc::new(RwLock::new(None)),
            notify: Arc::new(Notify::new()),
        }
    }

    /// Start the reconnect loop in a background task.
    /// Returns Arc to the client slot (callers read-lock to use).
    pub fn start(
        self,
        app_handle: tauri::AppHandle,
    ) -> Arc<RwLock<Option<GatewayClient>>> {
        let client = self.client.clone();
        let url = self.url.clone();
        let token = self.token.clone();

        tokio::spawn(async move {
            let mut backoff = Duration::from_secs(1);
            let max_backoff = Duration::from_secs(30);

            loop {
                tracing::info!("Connecting to gateway: {url}");
                let _ = app_handle.emit("gateway:status", "connecting");

                match GatewayClient::connect(&url).await {
                    Ok(gw) => {
                        match gw.handshake(&token).await {
                            Ok(_) => {
                                tracing::info!("Gateway connected and authenticated");
                                let _ = app_handle.emit("gateway:status", "connected");
                                backoff = Duration::from_secs(1); // reset

                                // Start broadcast forwarding
                                let mut rx = gw.subscribe();
                                {
                                    let mut lock = client.write().await;
                                    *lock = Some(gw);
                                }

                                // Forward broadcasts as Tauri events
                                loop {
                                    match rx.recv().await {
                                        Ok(bcast) => {
                                            let event_name = format!("gw:{}", bcast.method);
                                            let _ = app_handle.emit(&event_name, bcast.params.clone());
                                        }
                                        Err(broadcast::error::RecvError::Closed) => {
                                            tracing::warn!("Broadcast channel closed, reconnecting");
                                            break;
                                        }
                                        Err(broadcast::error::RecvError::Lagged(n)) => {
                                            tracing::warn!("Broadcast lagged by {n} messages");
                                        }
                                    }
                                }

                                // Connection lost
                                {
                                    let mut lock = client.write().await;
                                    *lock = None;
                                }
                                let _ = app_handle.emit("gateway:status", "disconnected");
                            }
                            Err(e) => {
                                tracing::error!("Handshake failed: {e}");
                            }
                        }
                    }
                    Err(e) => {
                        tracing::error!("Connection failed: {e}");
                    }
                }

                let _ = app_handle.emit("gateway:status", "reconnecting");
                tracing::info!("Reconnecting in {}s", backoff.as_secs());
                tokio::time::sleep(backoff).await;
                backoff = (backoff * 2).min(max_backoff);
            }
        });

        self.client
    }
}
```

**Verification**: Unit test simulating connect → disconnect → reconnect cycle. Gateway status events emitted correctly.

### Step 2.4 — Update AppState to use ReconnectManager

**Action**: Update `state.rs`:
```rust
use std::sync::Arc;
use tokio::sync::RwLock;
use crate::gateway::client::GatewayClient;

pub struct AppState {
    pub gateway: Arc<RwLock<Option<GatewayClient>>>,
}
```

Update `lib.rs` to start the reconnect manager in `setup()`:
```rust
.setup(|app| {
    let handle = app.handle().clone();
    let manager = ReconnectManager::new(
        "ws://127.0.0.1:18789".to_string(),
        "admin-token".to_string(), // TODO: configurable
    );
    let client = manager.start(handle);
    app.manage(AppState { gateway: client });
    Ok(())
})
```

**Verification**: App starts, connection status logged, reconnect works.

### Step 2.5 — IPC Commands: Agents (`commands/agents.rs`)

**Action**: Implement Tauri commands that use the gateway client.

```rust
use tauri::State;
use crate::state::AppState;
use crate::error::AppError;

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
    gw.send_request(
        "agents.files.list",
        Some(serde_json::json!({ "agentId": agent_id })),
    ).await
}

#[tauri::command]
pub async fn get_agent_file(
    state: State<'_, AppState>,
    agent_id: String,
    filename: String,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    gw.send_request(
        "agents.files.get",
        Some(serde_json::json!({ "agentId": agent_id, "filename": filename })),
    ).await
}

#[tauri::command]
pub async fn set_agent_file(
    state: State<'_, AppState>,
    agent_id: String,
    filename: String,
    content: String,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    gw.send_request(
        "agents.files.set",
        Some(serde_json::json!({
            "agentId": agent_id,
            "filename": filename,
            "content": content
        })),
    ).await
}
```

**Pattern**: Every other command module (config, chat, cron, sessions, skills) follows this exact same pattern — acquire read lock on gateway, check connected, call `send_request` with the appropriate method and params. Implement all 6 command modules using this pattern.

### Step 2.6 — IPC Commands: Config (`commands/config.rs`)

```rust
#[tauri::command]
pub async fn config_get(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    gw.send_request("config.get", None).await
}

#[tauri::command]
pub async fn config_patch(
    state: State<'_, AppState>,
    base_hash: String,
    raw: String,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    gw.send_request(
        "config.patch",
        Some(serde_json::json!({ "baseHash": base_hash, "raw": raw })),
    ).await
}

#[tauri::command]
pub async fn config_schema(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    gw.send_request("config.schema", None).await
}
```

### Step 2.7 — IPC Commands: Chat (`commands/chat.rs`)

```rust
#[tauri::command]
pub async fn chat_send(
    state: State<'_, AppState>,
    agent_id: String,
    message: String,
    session_key: Option<String>,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    let mut params = serde_json::json!({
        "agentId": agent_id,
        "message": message,
    });
    if let Some(sk) = session_key {
        params["sessionKey"] = serde_json::Value::String(sk);
    }
    gw.send_request("chat.send", Some(params)).await
}

#[tauri::command]
pub async fn chat_history(
    state: State<'_, AppState>,
    session_key: String,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    gw.send_request(
        "chat.history",
        Some(serde_json::json!({ "sessionKey": session_key })),
    ).await
}

#[tauri::command]
pub async fn chat_abort(
    state: State<'_, AppState>,
    run_id: String,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    gw.send_request(
        "chat.abort",
        Some(serde_json::json!({ "runId": run_id })),
    ).await
}
```

### Step 2.8 — IPC Commands: Sessions (`commands/sessions.rs`)

```rust
#[tauri::command]
pub async fn sessions_list(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    gw.send_request("sessions.list", None).await
}

#[tauri::command]
pub async fn sessions_resolve(
    state: State<'_, AppState>,
    session_key: String,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    gw.send_request(
        "sessions.resolve",
        Some(serde_json::json!({ "sessionKey": session_key })),
    ).await
}

#[tauri::command]
pub async fn sessions_reset(
    state: State<'_, AppState>,
    session_key: String,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    gw.send_request(
        "sessions.reset",
        Some(serde_json::json!({ "sessionKey": session_key })),
    ).await
}

#[tauri::command]
pub async fn sessions_delete(
    state: State<'_, AppState>,
    session_key: String,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    gw.send_request(
        "sessions.delete",
        Some(serde_json::json!({ "sessionKey": session_key })),
    ).await
}
```

### Step 2.9 — IPC Commands: Cron (`commands/cron.rs`)

```rust
#[tauri::command]
pub async fn cron_list(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    gw.send_request("cron.list", None).await
}

#[tauri::command]
pub async fn cron_status(
    state: State<'_, AppState>,
    cron_id: String,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    gw.send_request("cron.status", Some(serde_json::json!({ "cronId": cron_id }))).await
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
    gw.send_request("cron.remove", Some(serde_json::json!({ "cronId": cron_id }))).await
}

#[tauri::command]
pub async fn cron_run(
    state: State<'_, AppState>,
    cron_id: String,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    gw.send_request("cron.run", Some(serde_json::json!({ "cronId": cron_id }))).await
}

#[tauri::command]
pub async fn cron_runs(
    state: State<'_, AppState>,
    cron_id: String,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    gw.send_request("cron.runs", Some(serde_json::json!({ "cronId": cron_id }))).await
}
```

### Step 2.10 — IPC Commands: Skills (`commands/skills.rs`)

```rust
#[tauri::command]
pub async fn skills_status(
    state: State<'_, AppState>,
    agent_id: String,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    gw.send_request("skills.status", Some(serde_json::json!({ "agentId": agent_id }))).await
}

#[tauri::command]
pub async fn skills_install(
    state: State<'_, AppState>,
    agent_id: String,
    skill_name: String,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    gw.send_request(
        "skills.install",
        Some(serde_json::json!({ "agentId": agent_id, "skillName": skill_name })),
    ).await
}

#[tauri::command]
pub async fn skills_update(
    state: State<'_, AppState>,
    agent_id: String,
    params: serde_json::Value,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    let mut p = params;
    p["agentId"] = serde_json::Value::String(agent_id);
    gw.send_request("skills.update", Some(p)).await
}

#[tauri::command]
pub async fn skills_bins(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    gw.send_request("skills.bins", None).await
}
```

### Step 2.11 — Git Manager (`git/mod.rs`)

**Action**: Implement local git operations using the `git2` crate. These are fully local — no Gateway API calls.

```rust
use git2::{Repository, Signature, DiffOptions, Oid};
use crate::error::AppError;
use serde::Serialize;
use std::path::Path;

#[derive(Debug, Serialize)]
pub struct CommitInfo {
    pub id: String,
    pub message: String,
    pub timestamp: i64,
    pub author: String,
}

#[derive(Debug, Serialize)]
pub struct DiffInfo {
    pub filename: String,
    pub patch: String,
}

/// Ensure a git repo exists at the given path. Init if needed.
pub fn ensure_repo(workspace_path: &str) -> Result<Repository, AppError> {
    let path = Path::new(workspace_path);
    match Repository::open(path) {
        Ok(repo) => Ok(repo),
        Err(_) => {
            let repo = Repository::init(path)
                .map_err(|e| AppError::Git(e.to_string()))?;
            // Initial commit with empty tree
            let sig = Signature::now("OpenClaw Desktop", "openclaw@local")
                .map_err(|e| AppError::Git(e.to_string()))?;
            let tree_id = repo.index()
                .and_then(|mut idx| { idx.write()?; idx.write_tree() })
                .map_err(|e| AppError::Git(e.to_string()))?;
            let tree = repo.find_tree(tree_id)
                .map_err(|e| AppError::Git(e.to_string()))?;
            repo.commit(Some("HEAD"), &sig, &sig, "Initial commit", &tree, &[])
                .map_err(|e| AppError::Git(e.to_string()))?;
            Ok(repo)
        }
    }
}

/// Add all changed files and commit with message
pub fn commit_all(workspace_path: &str, message: &str) -> Result<String, AppError> {
    let repo = ensure_repo(workspace_path)?;
    let sig = Signature::now("OpenClaw Desktop", "openclaw@local")
        .map_err(|e| AppError::Git(e.to_string()))?;

    let mut index = repo.index().map_err(|e| AppError::Git(e.to_string()))?;
    index.add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)
        .map_err(|e| AppError::Git(e.to_string()))?;
    index.write().map_err(|e| AppError::Git(e.to_string()))?;

    let tree_id = index.write_tree().map_err(|e| AppError::Git(e.to_string()))?;
    let tree = repo.find_tree(tree_id).map_err(|e| AppError::Git(e.to_string()))?;

    let head = repo.head().map_err(|e| AppError::Git(e.to_string()))?;
    let parent = head.peel_to_commit().map_err(|e| AppError::Git(e.to_string()))?;

    let oid = repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &[&parent])
        .map_err(|e| AppError::Git(e.to_string()))?;

    Ok(oid.to_string())
}

/// Get commit log (most recent first, limited)
pub fn log(workspace_path: &str, limit: usize) -> Result<Vec<CommitInfo>, AppError> {
    let repo = ensure_repo(workspace_path)?;
    let mut revwalk = repo.revwalk().map_err(|e| AppError::Git(e.to_string()))?;
    revwalk.push_head().map_err(|e| AppError::Git(e.to_string()))?;
    revwalk.set_sorting(git2::Sort::TIME).map_err(|e| AppError::Git(e.to_string()))?;

    let mut commits = Vec::new();
    for oid_result in revwalk.take(limit) {
        let oid = oid_result.map_err(|e| AppError::Git(e.to_string()))?;
        let commit = repo.find_commit(oid).map_err(|e| AppError::Git(e.to_string()))?;
        commits.push(CommitInfo {
            id: oid.to_string(),
            message: commit.message().unwrap_or("").to_string(),
            timestamp: commit.time().seconds(),
            author: commit.author().name().unwrap_or("unknown").to_string(),
        });
    }

    Ok(commits)
}

/// Diff between two commits (or HEAD vs parent)
pub fn diff_commits(
    workspace_path: &str,
    old_commit_id: Option<&str>,
    new_commit_id: Option<&str>,
) -> Result<Vec<DiffInfo>, AppError> {
    let repo = ensure_repo(workspace_path)?;

    let new_commit = match new_commit_id {
        Some(id) => repo.find_commit(Oid::from_str(id).map_err(|e| AppError::Git(e.to_string()))?)
            .map_err(|e| AppError::Git(e.to_string()))?,
        None => repo.head()
            .and_then(|h| h.peel_to_commit())
            .map_err(|e| AppError::Git(e.to_string()))?,
    };

    let old_tree = match old_commit_id {
        Some(id) => {
            let commit = repo.find_commit(Oid::from_str(id).map_err(|e| AppError::Git(e.to_string()))?)
                .map_err(|e| AppError::Git(e.to_string()))?;
            Some(commit.tree().map_err(|e| AppError::Git(e.to_string()))?)
        }
        None => {
            new_commit.parent(0).ok()
                .and_then(|p| p.tree().ok())
        }
    };

    let new_tree = new_commit.tree().map_err(|e| AppError::Git(e.to_string()))?;

    let diff = repo.diff_tree_to_tree(
        old_tree.as_ref(),
        Some(&new_tree),
        Some(&mut DiffOptions::new()),
    ).map_err(|e| AppError::Git(e.to_string()))?;

    let mut diffs = Vec::new();
    diff.print(git2::DiffFormat::Patch, |delta, _hunk, line| {
        let filename = delta.new_file().path()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();

        let content = std::str::from_utf8(line.content()).unwrap_or("");
        let prefix = match line.origin() {
            '+' => "+",
            '-' => "-",
            _ => " ",
        };

        if let Some(last) = diffs.last_mut() {
            let d: &mut DiffInfo = last;
            if d.filename == filename {
                d.patch.push_str(prefix);
                d.patch.push_str(content);
                return true;
            }
        }
        diffs.push(DiffInfo {
            filename,
            patch: format!("{prefix}{content}"),
        });
        true
    }).map_err(|e| AppError::Git(e.to_string()))?;

    Ok(diffs)
}

/// Checkout a specific commit (detached HEAD)
pub fn checkout_commit(workspace_path: &str, commit_id: &str) -> Result<(), AppError> {
    let repo = ensure_repo(workspace_path)?;
    let oid = Oid::from_str(commit_id).map_err(|e| AppError::Git(e.to_string()))?;
    let commit = repo.find_commit(oid).map_err(|e| AppError::Git(e.to_string()))?;
    let obj = commit.as_object();

    repo.checkout_tree(obj, None).map_err(|e| AppError::Git(e.to_string()))?;
    repo.set_head_detached(oid).map_err(|e| AppError::Git(e.to_string()))?;

    Ok(())
}
```

**Git IPC commands** (add to `commands/agents.rs` or create `commands/git.rs`):
```rust
#[tauri::command]
pub async fn git_log(workspace_path: String, limit: Option<usize>) -> Result<Vec<CommitInfo>, AppError> {
    tokio::task::spawn_blocking(move || {
        crate::git::log(&workspace_path, limit.unwrap_or(50))
    }).await.map_err(|e| AppError::Other(e.to_string()))?
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
    }).await.map_err(|e| AppError::Other(e.to_string()))?
}

#[tauri::command]
pub async fn git_checkout(workspace_path: String, commit_id: String) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || {
        crate::git::checkout_commit(&workspace_path, &commit_id)
    }).await.map_err(|e| AppError::Other(e.to_string()))?
}
```

### Step 2.12 — Register all commands in `lib.rs`

**Action**: Update the `invoke_handler` to include all commands:

```rust
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
```

### Step 2.13 — Rust Unit Tests

**Action**: Write tests for protocol parsing, git operations, and client request matching.

**Protocol tests**: (in Step 2.1 already)

**Git tests** (`git/mod.rs`):
```rust
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
    fn test_commit_and_log() {
        let tmp = TempDir::new().unwrap();
        let path = tmp.path().to_str().unwrap();
        ensure_repo(path).unwrap();

        // Write a file
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
    }
}
```

**Add** `tempfile = "3"` to `[dev-dependencies]` in Cargo.toml.

**Verification**: `cargo test` all pass.

### Phase 2 Completion Criteria
- [ ] `cargo test` — all protocol, git, and integration tests pass
- [ ] `cargo check` — zero warnings
- [ ] Gateway client connects to a real Gateway instance
- [ ] Reconnect works after killing/restarting Gateway
- [ ] All IPC commands callable from frontend (invoke works, returns data)
- [ ] Git operations work on a test directory

---

## Phase 3: Frontend — State Management & Core Pages (Days 5-8)

**Goal**: All frontend pages functional with real data from the Rust backend.

### Step 3.1 — Complete `tauri-api.ts` with all IPC wrappers

**Action**: Extend `src/lib/tauri-api.ts` with typed wrappers for every Rust command:

```ts
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

// ============ Types ============

export interface Agent {
  id: string;
  name: string;
  model: string;
  workspace: string;
  status?: string;
}

export interface ConfigData {
  config: Record<string, unknown>;
  hash: string;
}

export interface CommitInfo {
  id: string;
  message: string;
  timestamp: number;
  author: string;
}

export interface DiffInfo {
  filename: string;
  patch: string;
}

export interface ChatEvent {
  runId: string;
  agentId: string;
  state: "delta" | "final" | "error";
  text?: string;
  message?: unknown;
  sessionKey?: string;
}

export interface CronJob {
  id: string;
  name: string;
  schedule: string;
  agentId: string;
  enabled: boolean;
  lastRun?: string;
}

export interface SkillInfo {
  name: string;
  description: string;
  enabled: boolean;
  installed: boolean;
  apiKey?: string;
  env?: Record<string, string>;
}

export interface Session {
  key: string;
  agentId: string;
  lastMessage?: string;
  updatedAt: string;
}

// ============ Agents ============

export const agents = {
  list: () => invoke<Agent[]>("list_agents"),
  filesList: (agentId: string) =>
    invoke<string[]>("get_agent_files", { agentId }),
  fileGet: (agentId: string, filename: string) =>
    invoke<string>("get_agent_file", { agentId, filename }),
  fileSet: (agentId: string, filename: string, content: string) =>
    invoke<void>("set_agent_file", { agentId, filename, content }),
};

// ============ Config ============

export const config = {
  get: () => invoke<ConfigData>("config_get"),
  patch: (baseHash: string, raw: string) =>
    invoke<void>("config_patch", { baseHash, raw }),
  schema: () => invoke<Record<string, unknown>>("config_schema"),
};

// ============ Chat ============

export const chat = {
  send: (agentId: string, message: string, sessionKey?: string) =>
    invoke<{ runId: string }>("chat_send", { agentId, message, sessionKey }),
  history: (sessionKey: string) =>
    invoke<unknown[]>("chat_history", { sessionKey }),
  abort: (runId: string) => invoke<void>("chat_abort", { runId }),
};

// ============ Sessions ============

export const sessions = {
  list: () => invoke<Session[]>("sessions_list"),
  resolve: (sessionKey: string) =>
    invoke<Session>("sessions_resolve", { sessionKey }),
  reset: (sessionKey: string) =>
    invoke<void>("sessions_reset", { sessionKey }),
  delete: (sessionKey: string) =>
    invoke<void>("sessions_delete", { sessionKey }),
};

// ============ Cron ============

export const cron = {
  list: () => invoke<CronJob[]>("cron_list"),
  status: (cronId: string) => invoke<CronJob>("cron_status", { cronId }),
  add: (params: Partial<CronJob>) => invoke<CronJob>("cron_add", { params }),
  update: (params: Partial<CronJob>) =>
    invoke<void>("cron_update", { params }),
  remove: (cronId: string) => invoke<void>("cron_remove", { cronId }),
  run: (cronId: string) => invoke<void>("cron_run", { cronId }),
  runs: (cronId: string) => invoke<unknown[]>("cron_runs", { cronId }),
};

// ============ Skills ============

export const skills = {
  status: (agentId: string) =>
    invoke<SkillInfo[]>("skills_status", { agentId }),
  install: (agentId: string, skillName: string) =>
    invoke<void>("skills_install", { agentId, skillName }),
  update: (agentId: string, params: Partial<SkillInfo>) =>
    invoke<void>("skills_update", { agentId, params }),
  bins: () => invoke<Record<string, boolean>>("skills_bins"),
};

// ============ Git ============

export const git = {
  log: (workspacePath: string, limit?: number) =>
    invoke<CommitInfo[]>("git_log", { workspacePath, limit }),
  diff: (workspacePath: string, oldCommitId?: string, newCommitId?: string) =>
    invoke<DiffInfo[]>("git_diff", { workspacePath, oldCommitId, newCommitId }),
  checkout: (workspacePath: string, commitId: string) =>
    invoke<void>("git_checkout", { workspacePath, commitId }),
};

// ============ Events ============

export function onGatewayStatus(callback: (status: string) => void): Promise<UnlistenFn> {
  return listen<string>("gateway:status", (event) => callback(event.payload));
}

export function onChatEvent(callback: (event: ChatEvent) => void): Promise<UnlistenFn> {
  return listen<ChatEvent>("gw:chat", (event) => callback(event.payload));
}
```

**Verification**: TypeScript compiles, all exports match Rust command names.

### Step 3.2 — Zustand Stores

**Action**: Create zustand stores for each domain:

**`src/stores/gateway-store.ts`**:
```ts
import { create } from "zustand";
import { onGatewayStatus } from "../lib/tauri-api";

type GatewayStatus = "connecting" | "connected" | "disconnected" | "reconnecting";

interface GatewayStore {
  status: GatewayStatus;
  setStatus: (status: GatewayStatus) => void;
  init: () => void;
}

export const useGatewayStore = create<GatewayStore>((set) => ({
  status: "disconnected",
  setStatus: (status) => set({ status }),
  init: () => {
    onGatewayStatus((status) => {
      set({ status: status as GatewayStatus });
    });
  },
}));
```

**`src/stores/agents-store.ts`**:
```ts
import { create } from "zustand";
import { agents as api, type Agent } from "../lib/tauri-api";

interface AgentsStore {
  agents: Agent[];
  loading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
}

export const useAgentsStore = create<AgentsStore>((set) => ({
  agents: [],
  loading: false,
  error: null,
  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const result = await api.list();
      set({ agents: result, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },
}));
```

**`src/stores/chat-store.ts`**:
```ts
import { create } from "zustand";
import { chat as chatApi, sessions as sessionsApi, onChatEvent, type ChatEvent, type Session } from "../lib/tauri-api";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface ChatTab {
  sessionKey: string;
  agentId: string;
  messages: ChatMessage[];
  streaming: boolean;
  streamBuffer: string;
  runId: string | null;
}

interface ChatStore {
  tabs: ChatTab[];
  activeTabIndex: number;
  sessions: Session[];

  // Actions
  loadSessions: () => Promise<void>;
  openTab: (agentId: string, sessionKey?: string) => void;
  closeTab: (index: number) => void;
  setActiveTab: (index: number) => void;
  sendMessage: (message: string) => Promise<void>;
  abortCurrent: () => Promise<void>;
  loadHistory: (sessionKey: string) => Promise<void>;
  handleChatEvent: (event: ChatEvent) => void;
  init: () => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  tabs: [],
  activeTabIndex: 0,
  sessions: [],

  loadSessions: async () => {
    const result = await sessionsApi.list();
    set({ sessions: result });
  },

  openTab: (agentId, sessionKey) => {
    const key = sessionKey || `${agentId}-${Date.now()}`;
    const tab: ChatTab = {
      sessionKey: key,
      agentId,
      messages: [],
      streaming: false,
      streamBuffer: "",
      runId: null,
    };
    set((state) => ({
      tabs: [...state.tabs, tab],
      activeTabIndex: state.tabs.length,
    }));
  },

  closeTab: (index) => {
    set((state) => {
      const tabs = state.tabs.filter((_, i) => i !== index);
      return {
        tabs,
        activeTabIndex: Math.min(state.activeTabIndex, tabs.length - 1),
      };
    });
  },

  setActiveTab: (index) => set({ activeTabIndex: index }),

  sendMessage: async (message) => {
    const { tabs, activeTabIndex } = get();
    const tab = tabs[activeTabIndex];
    if (!tab) return;

    // Add user message
    const userMsg: ChatMessage = { role: "user", content: message, timestamp: Date.now() };
    const updatedTabs = [...tabs];
    updatedTabs[activeTabIndex] = {
      ...tab,
      messages: [...tab.messages, userMsg],
      streaming: true,
      streamBuffer: "",
    };
    set({ tabs: updatedTabs });

    try {
      const result = await chatApi.send(tab.agentId, message, tab.sessionKey);
      // Update runId for abort support
      const newTabs = [...get().tabs];
      newTabs[activeTabIndex] = { ...newTabs[activeTabIndex], runId: result.runId };
      set({ tabs: newTabs });
    } catch (e) {
      // Handle send error
      const newTabs = [...get().tabs];
      newTabs[activeTabIndex] = { ...newTabs[activeTabIndex], streaming: false };
      set({ tabs: newTabs });
    }
  },

  abortCurrent: async () => {
    const { tabs, activeTabIndex } = get();
    const tab = tabs[activeTabIndex];
    if (tab?.runId) {
      await chatApi.abort(tab.runId);
    }
  },

  loadHistory: async (sessionKey) => {
    const history = await chatApi.history(sessionKey);
    // Map history to messages — format depends on Gateway response
    // Implementation depends on actual Gateway history format
  },

  handleChatEvent: (event) => {
    set((state) => {
      const tabs = [...state.tabs];
      const tabIndex = tabs.findIndex((t) => t.runId === event.runId);
      if (tabIndex === -1) return state;

      const tab = { ...tabs[tabIndex] };

      if (event.state === "delta" && event.text) {
        tab.streamBuffer += event.text;
      } else if (event.state === "final") {
        tab.messages = [
          ...tab.messages,
          { role: "assistant", content: tab.streamBuffer, timestamp: Date.now() },
        ];
        tab.streamBuffer = "";
        tab.streaming = false;
        tab.runId = null;
      } else if (event.state === "error") {
        tab.streaming = false;
        tab.runId = null;
      }

      tabs[tabIndex] = tab;
      return { tabs };
    });
  },

  init: () => {
    onChatEvent((event) => {
      get().handleChatEvent(event);
    });
  },
}));
```

**Also create**: `config-store.ts`, `cron-store.ts`, `skills-store.ts` following the same pattern (fetch + loading + error).

**Verification**: All stores compile, no TypeScript errors.

### Step 3.3 — MainLayout with Sidebar

**Action**: Build `src/layouts/MainLayout.tsx` using shadcn Sidebar:

```tsx
import { Outlet, NavLink } from "react-router-dom";
import { useGatewayStore } from "../stores/gateway-store";
import { useEffect } from "react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";
import { Bot, Settings, Clock, MessageSquare } from "lucide-react";

const navItems = [
  { to: "/agents", label: "Agents", icon: Bot },
  { to: "/chat", label: "Chat", icon: MessageSquare },
  { to: "/cron", label: "Cron", icon: Clock },
  { to: "/config", label: "Config", icon: Settings },
];

export function MainLayout() {
  const { status, init } = useGatewayStore();

  useEffect(() => { init(); }, [init]);

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <Sidebar>
          <SidebarContent>
            <SidebarGroup>
              <div className="px-3 py-2">
                <h2 className="text-lg font-semibold">OpenClaw</h2>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={`h-2 w-2 rounded-full ${
                    status === "connected" ? "bg-green-500" :
                    status === "connecting" || status === "reconnecting" ? "bg-yellow-500" :
                    "bg-red-500"
                  }`} />
                  {status}
                </div>
              </div>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild>
                        <NavLink to={item.to} className={({ isActive }) =>
                          isActive ? "bg-accent" : ""
                        }>
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <main className="flex-1 overflow-auto">
          <div className="flex items-center gap-2 border-b px-4 py-2">
            <SidebarTrigger />
          </div>
          <div className="p-4">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
```

Install `lucide-react`:
```bash
npm install lucide-react
```

**Verification**: Sidebar renders with nav links, connection status dot updates.

### Step 3.4 — Agents Page (`pages/Agents.tsx`)

```tsx
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useAgentsStore } from "../stores/agents-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function Agents() {
  const { agents, loading, error, fetch } = useAgentsStore();

  useEffect(() => { fetch(); }, [fetch]);

  if (loading) return <div className="text-muted-foreground">Loading agents...</div>;
  if (error) return <div className="text-destructive">Error: {error}</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Agents</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((agent) => (
          <Link key={agent.id} to={`/agents/${agent.id}`}>
            <Card className="hover:border-primary transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="text-base">{agent.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground space-y-1">
                  <div>ID: <code className="text-xs">{agent.id}</code></div>
                  <div>Model: <Badge variant="outline">{agent.model}</Badge></div>
                  <div className="truncate">Workspace: {agent.workspace}</div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

Install shadcn components:
```bash
npx shadcn@latest add card badge tabs textarea scroll-area separator
```

### Step 3.5 — AgentDetail Page with Tabs (`pages/AgentDetail.tsx`)

**Action**: Tabbed view with Files, Skills, MCP, History tabs.

```tsx
import { useParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileEditor } from "../components/FileEditor";
import { SkillsPanel } from "../components/SkillsPanel";
import { McpEditor } from "../components/McpEditor";
import { HistoryPanel } from "../components/HistoryPanel";
import { useAgentsStore } from "../stores/agents-store";

export function AgentDetail() {
  const { id } = useParams<{ id: string }>();
  const agent = useAgentsStore((s) => s.agents.find((a) => a.id === id));

  if (!agent) return <div>Agent not found</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">{agent.name}</h1>
      <p className="text-sm text-muted-foreground mb-4">{agent.workspace}</p>

      <Tabs defaultValue="files">
        <TabsList>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
          <TabsTrigger value="mcp">MCP</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="files">
          <FileEditor agentId={agent.id} workspace={agent.workspace} />
        </TabsContent>
        <TabsContent value="skills">
          <SkillsPanel agentId={agent.id} />
        </TabsContent>
        <TabsContent value="mcp">
          <McpEditor agentId={agent.id} />
        </TabsContent>
        <TabsContent value="history">
          <HistoryPanel workspace={agent.workspace} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### Step 3.6 — FileEditor Component (`components/FileEditor.tsx`)

```tsx
import { useState, useEffect, useCallback } from "react";
import MDEditor from "@uiw/react-md-editor";
import { agents as api } from "../lib/tauri-api";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  agentId: string;
  workspace: string;
}

export function FileEditor({ agentId, workspace }: Props) {
  const [files, setFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.filesList(agentId).then(setFiles);
  }, [agentId]);

  useEffect(() => {
    if (selectedFile) {
      api.fileGet(agentId, selectedFile).then((c) => {
        setContent(c);
        setOriginalContent(c);
      });
    }
  }, [agentId, selectedFile]);

  const save = useCallback(async () => {
    if (!selectedFile) return;
    setSaving(true);
    try {
      await api.fileSet(agentId, selectedFile, content);
      setOriginalContent(content);
      // Git commit happens automatically on save (Rust side)
    } finally {
      setSaving(false);
    }
  }, [agentId, selectedFile, content]);

  const isDirty = content !== originalContent;

  return (
    <div className="flex gap-4 h-[calc(100vh-220px)]">
      {/* File list sidebar */}
      <ScrollArea className="w-48 border rounded-md">
        <div className="p-2 space-y-1">
          {files.map((file) => (
            <button
              key={file}
              onClick={() => setSelectedFile(file)}
              className={`w-full text-left px-2 py-1.5 rounded text-sm ${
                selectedFile === file ? "bg-accent" : "hover:bg-muted"
              }`}
            >
              {file}
            </button>
          ))}
        </div>
      </ScrollArea>

      {/* Editor */}
      <div className="flex-1 flex flex-col">
        {selectedFile && (
          <>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{selectedFile}</span>
              <Button
                size="sm"
                onClick={save}
                disabled={!isDirty || saving}
              >
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
            <div className="flex-1" data-color-mode="dark">
              <MDEditor
                value={content}
                onChange={(v) => setContent(v || "")}
                height="100%"
              />
            </div>
          </>
        )}
        {!selectedFile && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Select a file to edit
          </div>
        )}
      </div>
    </div>
  );
}
```

### Step 3.7 — SkillsPanel Component (`components/SkillsPanel.tsx`)

```tsx
import { useState, useEffect } from "react";
import { skills as api, type SkillInfo } from "../lib/tauri-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  agentId: string;
}

export function SkillsPanel({ agentId }: Props) {
  const [skillList, setSkillList] = useState<SkillInfo[]>([]);
  const [installName, setInstallName] = useState("");

  useEffect(() => {
    api.status(agentId).then(setSkillList);
  }, [agentId]);

  const toggleSkill = async (skill: SkillInfo) => {
    await api.update(agentId, { name: skill.name, enabled: !skill.enabled });
    const updated = await api.status(agentId);
    setSkillList(updated);
  };

  const installSkill = async () => {
    if (!installName.trim()) return;
    await api.install(agentId, installName.trim());
    setInstallName("");
    const updated = await api.status(agentId);
    setSkillList(updated);
  };

  return (
    <div className="space-y-4">
      {/* Install new skill */}
      <div className="flex gap-2">
        <Input
          placeholder="Skill name to install..."
          value={installName}
          onChange={(e) => setInstallName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && installSkill()}
        />
        <Button onClick={installSkill}>Install</Button>
      </div>

      {/* Skill cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {skillList.map((skill) => (
          <Card key={skill.name}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{skill.name}</CardTitle>
                <Switch
                  checked={skill.enabled}
                  onCheckedChange={() => toggleSkill(skill)}
                />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{skill.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

Install shadcn components:
```bash
npx shadcn@latest add switch input
```

### Step 3.8 — HistoryPanel Component (`components/HistoryPanel.tsx`)

```tsx
import { useState, useEffect } from "react";
import { git, type CommitInfo, type DiffInfo } from "../lib/tauri-api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

interface Props {
  workspace: string;
}

export function HistoryPanel({ workspace }: Props) {
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
  const [diffs, setDiffs] = useState<DiffInfo[]>([]);

  useEffect(() => {
    git.log(workspace, 50).then(setCommits);
  }, [workspace]);

  useEffect(() => {
    if (selectedCommit) {
      git.diff(workspace, undefined, selectedCommit).then(setDiffs);
    }
  }, [workspace, selectedCommit]);

  const rollback = async (commitId: string) => {
    if (!confirm("Rollback to this commit? Current changes will be lost.")) return;
    await git.checkout(workspace, commitId);
    const updated = await git.log(workspace, 50);
    setCommits(updated);
  };

  return (
    <div className="flex gap-4 h-[calc(100vh-220px)]">
      {/* Commit list */}
      <ScrollArea className="w-72 border rounded-md">
        <div className="p-2 space-y-1">
          {commits.map((commit) => (
            <button
              key={commit.id}
              onClick={() => setSelectedCommit(commit.id)}
              className={`w-full text-left px-2 py-2 rounded text-sm ${
                selectedCommit === commit.id ? "bg-accent" : "hover:bg-muted"
              }`}
            >
              <div className="font-medium truncate">{commit.message}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(commit.timestamp * 1000).toLocaleString()}
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>

      {/* Diff view */}
      <div className="flex-1 flex flex-col">
        {selectedCommit && (
          <>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                {commits.find((c) => c.id === selectedCommit)?.message}
              </span>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => rollback(selectedCommit)}
              >
                Rollback
              </Button>
            </div>
            <ScrollArea className="flex-1 border rounded-md">
              <pre className="p-3 text-xs font-mono whitespace-pre-wrap">
                {diffs.map((d) => (
                  <div key={d.filename} className="mb-4">
                    <div className="font-bold text-primary mb-1">
                      {d.filename}
                    </div>
                    {d.patch.split("\n").map((line, i) => (
                      <div
                        key={i}
                        className={
                          line.startsWith("+") ? "text-green-500 bg-green-500/10" :
                          line.startsWith("-") ? "text-red-500 bg-red-500/10" :
                          ""
                        }
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                ))}
              </pre>
            </ScrollArea>
          </>
        )}
      </div>
    </div>
  );
}
```

### Step 3.9 — Chat Page (`pages/Chat.tsx`)

```tsx
import { useEffect, useRef, useState } from "react";
import { useChatStore } from "../stores/chat-store";
import { useAgentsStore } from "../stores/agents-store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Send, StopCircle } from "lucide-react";

export function Chat() {
  const {
    tabs, activeTabIndex, sessions,
    openTab, closeTab, setActiveTab, sendMessage, abortCurrent,
    loadSessions, init,
  } = useChatStore();
  const agents = useAgentsStore((s) => s.agents);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { init(); loadSessions(); }, [init, loadSessions]);

  const activeTab = tabs[activeTabIndex];

  const handleSend = async () => {
    if (!input.trim() || !activeTab) return;
    const msg = input;
    setInput("");
    await sendMessage(msg);
  };

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeTab?.messages.length, activeTab?.streamBuffer]);

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b pb-1 mb-2 overflow-x-auto">
        {tabs.map((tab, i) => (
          <div
            key={tab.sessionKey}
            className={`flex items-center gap-1 px-3 py-1 rounded-t text-sm cursor-pointer ${
              i === activeTabIndex ? "bg-accent" : "hover:bg-muted"
            }`}
            onClick={() => setActiveTab(i)}
          >
            <span className="truncate max-w-[120px]">{tab.agentId}</span>
            <button onClick={(e) => { e.stopPropagation(); closeTab(i); }}>
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {/* New chat button */}
        <select
          className="text-sm border rounded px-2 py-1"
          value=""
          onChange={(e) => {
            if (e.target.value) openTab(e.target.value);
          }}
        >
          <option value="">+ New Chat</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

      {/* Messages */}
      {activeTab ? (
        <>
          <ScrollArea className="flex-1 px-2">
            <div className="space-y-3">
              {activeTab.messages.map((msg, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg text-sm ${
                    msg.role === "user"
                      ? "bg-primary/10 ml-12"
                      : "bg-muted mr-12"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              ))}
              {activeTab.streaming && activeTab.streamBuffer && (
                <div className="bg-muted mr-12 p-3 rounded-lg text-sm">
                  <div className="whitespace-pre-wrap">{activeTab.streamBuffer}</div>
                  <span className="inline-block w-2 h-4 bg-foreground animate-pulse" />
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="flex gap-2 pt-2 border-t mt-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type a message..."
              className="resize-none"
              rows={2}
            />
            {activeTab.streaming ? (
              <Button variant="destructive" size="icon" onClick={abortCurrent}>
                <StopCircle className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="icon" onClick={handleSend} disabled={!input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          Select an agent to start chatting
        </div>
      )}
    </div>
  );
}
```

### Step 3.10 — Config Page (`pages/Config.tsx`)

```tsx
import { useState, useEffect, useCallback } from "react";
import { config as configApi } from "../lib/tauri-api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

export function Config() {
  const [raw, setRaw] = useState("");
  const [hash, setHash] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const result = await configApi.get();
      setRaw(JSON.stringify(result.config, null, 2));
      setHash(result.hash);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const save = async () => {
    setSaving(true);
    try {
      await configApi.patch(hash, raw);
      toast({ title: "Config saved" });
      await loadConfig(); // Re-fetch to get new hash
    } catch (e) {
      const errMsg = String(e);
      if (errMsg.includes("hash") || errMsg.includes("conflict")) {
        toast({
          title: "Conflict detected",
          description: "Config was modified externally. Reloading...",
          variant: "destructive",
        });
        await loadConfig();
      } else {
        toast({ title: "Save failed", description: errMsg, variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-muted-foreground">Loading config...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Configuration</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadConfig}>Reload</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
      <Textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        className="font-mono text-sm h-[calc(100vh-200px)]"
      />
    </div>
  );
}
```

Install shadcn toast:
```bash
npx shadcn@latest add toast
```

### Step 3.11 — Cron Page (`pages/Cron.tsx`)

```tsx
import { useState, useEffect } from "react";
import { cron as cronApi, type CronJob } from "../lib/tauri-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Trash2 } from "lucide-react";

export function Cron() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const result = await cronApi.list();
      setJobs(result);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadJobs(); }, []);

  const runJob = async (cronId: string) => {
    await cronApi.run(cronId);
    await loadJobs();
  };

  const removeJob = async (cronId: string) => {
    if (!confirm("Remove this cron job?")) return;
    await cronApi.remove(cronId);
    await loadJobs();
  };

  if (loading) return <div className="text-muted-foreground">Loading cron jobs...</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Cron Jobs</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {jobs.map((job) => (
          <Card key={job.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{job.name}</CardTitle>
                <Badge variant={job.enabled ? "default" : "secondary"}>
                  {job.enabled ? "Active" : "Paused"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>Schedule: <code>{job.schedule}</code></div>
                <div>Agent: {job.agentId}</div>
                {job.lastRun && <div>Last run: {job.lastRun}</div>}
              </div>
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="outline" onClick={() => runJob(job.id)}>
                  <Play className="h-3 w-3 mr-1" /> Run Now
                </Button>
                <Button size="sm" variant="ghost" onClick={() => removeJob(job.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

### Phase 3 Completion Criteria
- [ ] TypeScript compiles with zero errors
- [ ] All pages render with real data from Rust backend
- [ ] Chat streaming works end-to-end (send → deltas → final)
- [ ] File editor saves and triggers git commit
- [ ] Config editor handles optimistic locking conflicts
- [ ] Cron jobs list, run, and remove
- [ ] Skills toggle, install, and configure

---

## Phase 4: MCP Editor & Chat Polish (Days 9-10)

**Goal**: MCP config editor for TOOLS.md, chat history loading, session management.

### Step 4.1 — McpEditor Component (`components/McpEditor.tsx`)

**Action**: Parse MCP server configurations from TOOLS.md, present as editable forms, write back.

TOOLS.md format (fenced code blocks with JSON):
```markdown
## MCP Servers

\`\`\`json mcp-server-name
{
  "command": "npx",
  "args": ["-y", "@some/mcp-server"],
  "env": { "API_KEY": "xxx" }
}
\`\`\`
```

```tsx
import { useState, useEffect, useCallback } from "react";
import { agents as api } from "../lib/tauri-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";

interface McpServer {
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
}

interface Props {
  agentId: string;
}

function parseToolsMd(content: string): McpServer[] {
  const servers: McpServer[] = [];
  const regex = /```json\s+(\S+)\s*\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    try {
      const config = JSON.parse(match[2]);
      servers.push({
        name: match[1],
        command: config.command || "",
        args: config.args || [],
        env: config.env || {},
      });
    } catch {
      // Skip malformed entries
    }
  }
  return servers;
}

function serializeToolsMd(servers: McpServer[]): string {
  let md = "## MCP Servers\n\n";
  for (const server of servers) {
    const config = {
      command: server.command,
      args: server.args,
      env: server.env,
    };
    md += `\`\`\`json ${server.name}\n${JSON.stringify(config, null, 2)}\n\`\`\`\n\n`;
  }
  return md;
}

export function McpEditor({ agentId }: Props) {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.fileGet(agentId, "TOOLS.md").then((content) => {
      setServers(parseToolsMd(content));
    }).catch(() => setServers([]));
  }, [agentId]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const md = serializeToolsMd(servers);
      await api.fileSet(agentId, "TOOLS.md", md);
    } finally {
      setSaving(false);
    }
  }, [agentId, servers]);

  const addServer = () => {
    setServers([...servers, { name: "new-server", command: "", args: [], env: {} }]);
  };

  const removeServer = (index: number) => {
    setServers(servers.filter((_, i) => i !== index));
  };

  const updateServer = (index: number, updates: Partial<McpServer>) => {
    const updated = [...servers];
    updated[index] = { ...updated[index], ...updates };
    setServers(updated);
  };

  const addEnvVar = (index: number) => {
    const updated = [...servers];
    updated[index].env = { ...updated[index].env, "": "" };
    setServers(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">MCP Servers</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={addServer}>
            <Plus className="h-3 w-3 mr-1" /> Add Server
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {servers.map((server, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Input
                value={server.name}
                onChange={(e) => updateServer(i, { name: e.target.value })}
                className="font-mono text-sm w-auto"
                placeholder="server-name"
              />
              <Button size="sm" variant="ghost" onClick={() => removeServer(i)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <label className="text-xs text-muted-foreground">Command</label>
              <Input
                value={server.command}
                onChange={(e) => updateServer(i, { command: e.target.value })}
                placeholder="npx"
                className="font-mono text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Args (comma-separated)</label>
              <Input
                value={server.args.join(", ")}
                onChange={(e) => updateServer(i, {
                  args: e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                })}
                placeholder="-y, @some/mcp-server"
                className="font-mono text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Environment Variables</label>
              {Object.entries(server.env).map(([key, value], j) => (
                <div key={j} className="flex gap-2 mt-1">
                  <Input
                    value={key}
                    onChange={(e) => {
                      const newEnv = { ...server.env };
                      delete newEnv[key];
                      newEnv[e.target.value] = value;
                      updateServer(i, { env: newEnv });
                    }}
                    placeholder="KEY"
                    className="font-mono text-sm flex-1"
                  />
                  <Input
                    value={value}
                    onChange={(e) => {
                      updateServer(i, { env: { ...server.env, [key]: e.target.value } });
                    }}
                    placeholder="value"
                    className="font-mono text-sm flex-1"
                  />
                </div>
              ))}
              <Button size="sm" variant="ghost" onClick={() => addEnvVar(i)} className="mt-1 text-xs">
                + Add variable
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

### Step 4.2 — Chat History Loading

**Action**: Update `useChatStore.loadHistory` to actually parse and populate messages from the Gateway's `chat.history` response.

```ts
loadHistory: async (sessionKey) => {
  const history = await chatApi.history(sessionKey);
  // Gateway returns array of { role, content, timestamp } (adjust to actual format)
  const messages: ChatMessage[] = (history as any[]).map((msg) => ({
    role: msg.role as "user" | "assistant",
    content: msg.content || msg.text || "",
    timestamp: msg.timestamp || Date.now(),
  }));

  set((state) => {
    const tabs = [...state.tabs];
    const tabIndex = tabs.findIndex((t) => t.sessionKey === sessionKey);
    if (tabIndex !== -1) {
      tabs[tabIndex] = { ...tabs[tabIndex], messages };
    }
    return { tabs };
  });
},
```

When opening an existing session tab, call `loadHistory` automatically:
```ts
openTab: (agentId, sessionKey) => {
  const key = sessionKey || `${agentId}-${Date.now()}`;
  // ... create tab ...
  if (sessionKey) {
    // Existing session — load history
    setTimeout(() => get().loadHistory(key), 0);
  }
},
```

### Step 4.3 — Session Management UI

**Action**: Add session list sidebar to Chat page showing existing sessions that can be opened.

Add to Chat.tsx — a collapsible panel listing `sessions` from the store, clicking opens a tab with that session's history.

### Step 4.4 — Chat session reset/delete

**Action**: Add context menu or buttons on chat tabs:
- "Reset" → calls `sessions.reset(sessionKey)`, clears messages in tab
- "Delete" → calls `sessions.delete(sessionKey)`, closes tab, removes from sessions list

### Phase 4 Completion Criteria
- [ ] MCP editor parses TOOLS.md correctly
- [ ] MCP editor saves back to TOOLS.md in correct format
- [ ] Chat loads history for existing sessions
- [ ] Session reset/delete works end-to-end

---

## Phase 5: Polish & Error Handling (Days 11-12)

**Goal**: Production-quality UX with proper error handling, toasts, and macOS integration.

### Step 5.1 — Toast Notifications

**Action**: Add toast notifications for all error and success states:
- File save success/failure
- Config save success/conflict
- Cron run triggered
- Skill install success/failure
- Gateway connection/disconnection
- Git commit success/failure

Use shadcn `Toaster` component, already installed.

### Step 5.2 — Loading States

**Action**: Add skeleton loading states using shadcn `Skeleton` for:
- Agent cards while loading
- File content while loading
- Config content while loading
- Cron job list while loading
- Skills list while loading

```bash
npx shadcn@latest add skeleton
```

### Step 5.3 — Error Boundaries

**Action**: Add React error boundary wrapper for each page:

```tsx
import { Component, type ReactNode } from "react";

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 border border-destructive rounded-md">
          <h3 className="font-bold text-destructive">Something went wrong</h3>
          <pre className="text-xs mt-2">{this.state.error?.message}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
```

Wrap each `<Route>` element with `<ErrorBoundary>`.

### Step 5.4 — macOS Native Integration

**Action**: Configure `tauri.conf.json` for macOS:
```json
{
  "app": {
    "windows": [{
      "title": "OpenClaw Desktop",
      "width": 1200,
      "height": 800,
      "minWidth": 800,
      "minHeight": 600
    }],
    "macOSPrivateApi": true
  }
}
```

### Step 5.5 — Keyboard Shortcuts

**Action**: Add global keyboard shortcuts:
- `Cmd+S` — Save current file/config
- `Cmd+N` — New chat tab
- `Cmd+W` — Close current chat tab
- `Cmd+1-5` — Switch sidebar sections

Use `@tauri-apps/plugin-global-shortcut` or browser keyboard events.

### Step 5.6 — Gateway Reconnection UX

**Action**: When gateway is disconnected:
- Show a persistent banner at top: "Gateway disconnected. Reconnecting..."
- Disable all action buttons (save, send, etc.)
- Re-enable when connected
- Show toast on reconnection: "Gateway reconnected"

### Phase 5 Completion Criteria
- [ ] All errors show user-friendly toast messages
- [ ] Loading states prevent layout shifts
- [ ] Error boundaries prevent white screens
- [ ] macOS window configured properly
- [ ] Keyboard shortcuts work
- [ ] Gateway disconnect/reconnect UX is clear

---

## Phase 6: Testing (Days 12-13)

### Step 6.1 — Rust Unit Tests

Already covered in Phase 2 (protocol parsing, git operations).

Additional tests needed:
- `gateway/reconnect.rs` — mock connection, verify backoff timing
- `commands/*.rs` — verify error handling when gateway not connected

### Step 6.2 — Frontend Tests (Vitest + React Testing Library)

**Action**: Set up Vitest:

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
```

**Tests to write**:
- `AgentCard.test.tsx` — renders agent info correctly
- `ChatMessage.test.tsx` — renders user/assistant messages differently
- `McpEditor.test.tsx` — parseToolsMd/serializeToolsMd round-trip
- Store tests — verify zustand store actions update state correctly

### Step 6.3 — Manual E2E Testing Checklist

Run with a real OpenClaw Gateway:
- [ ] App launches, connects to Gateway
- [ ] Agents page shows all agents
- [ ] Click agent → detail page with tabs
- [ ] Edit a workspace file → Save → Git commit appears in History
- [ ] Rollback a git commit → File content reverts
- [ ] Config page → Edit → Save → Reload shows changes
- [ ] Config page → External edit → Save → Conflict detected
- [ ] Cron page → List jobs → Run one → Check status
- [ ] Chat → New tab → Send message → Streaming response appears
- [ ] Chat → Abort mid-stream
- [ ] Chat → Close tab
- [ ] Skills → Toggle enable/disable
- [ ] Skills → Install new skill
- [ ] MCP → Edit server config → Save → Verify TOOLS.md
- [ ] Kill Gateway → "Reconnecting..." shown → Restart Gateway → Auto-reconnects

### Phase 6 Completion Criteria
- [ ] `cargo test` passes
- [ ] `npm run test` passes (Vitest)
- [ ] Manual E2E checklist fully verified

---

## Implementation Order Summary

| Order | Step | Deliverable | Depends On |
|-------|------|------------|------------|
| 1 | 1.1-1.6 | Tauri v2 skeleton with routing | Nothing |
| 2 | 2.1-2.3 | Gateway client + reconnect | Step 1 |
| 3 | 2.4-2.12 | All IPC commands | Step 2 |
| 4 | 2.13 | Rust tests | Step 3 |
| 5 | 3.1-3.2 | tauri-api + zustand stores | Step 3 |
| 6 | 3.3-3.11 | All pages + components | Step 5 |
| 7 | 4.1-4.4 | MCP editor + chat polish | Step 6 |
| 8 | 5.1-5.6 | Error handling + UX polish | Step 7 |
| 9 | 6.1-6.3 | Testing | Step 8 |

## Execution Strategy

Each phase should be implemented and verified before moving to the next. Within a phase, steps can be parallelized where dependencies allow (e.g., all IPC command modules can be written in parallel in Phase 2).

**Critical path**: Phase 1 → Phase 2 (Steps 2.1-2.3) → Everything else can partially parallelize.

**Delegation guidance**:
- Phase 1 (scaffolding): `category="quick"` — straightforward project init
- Phase 2 (Rust backend): `category="deep"` with skills `["senior-fullstack"]` — complex async Rust
- Phase 3 (Frontend): `category="visual-engineering"` with skills `["senior-frontend", "shadcn-ui"]`
- Phase 4-5 (Polish): `category="visual-engineering"` with skills `["senior-frontend", "shadcn-ui"]`
- Phase 6 (Testing): `category="unspecified-low"` with skills `["test-patterns", "senior-qa"]`

---

## Errata — Post-Review Fixes (MANDATORY)

The following corrections address issues found during Oracle review. **All items below override conflicting content in the phases above.** Implementers MUST apply these before starting any phase.

---

### FIX-1: IPC Argument Name Convention (CRITICAL)

**Problem**: Tauri v2 deserializes IPC args using the **Rust parameter name** exactly. The plan has Rust using `snake_case` (`agent_id`) but TypeScript sending `camelCase` (`agentId`). This will fail at runtime — Tauri won't match the args.

**Resolution**: Use `#[serde(rename_all = "camelCase")]` on a params struct, OR use `snake_case` keys in TypeScript invoke calls.

**Decision: Use snake_case keys in TypeScript invoke calls** (simplest, no extra Rust structs needed).

**Canonical IPC Contract Table** — all TS `invoke()` calls MUST use these exact key names:

| Rust Command | Rust Params | TS invoke keys |
|---|---|---|
| `list_agents` | (none) | `{}` |
| `get_agent_files` | `agent_id: String` | `{ agent_id }` |
| `get_agent_file` | `agent_id: String, filename: String` | `{ agent_id, filename }` |
| `set_agent_file` | `agent_id: String, filename: String, content: String` | `{ agent_id, filename, content }` |
| `config_get` | (none) | `{}` |
| `config_patch` | `base_hash: String, raw: String` | `{ base_hash, raw }` |
| `config_schema` | (none) | `{}` |
| `chat_send` | `agent_id: String, message: String, session_key: Option<String>` | `{ agent_id, message, session_key? }` |
| `chat_history` | `session_key: String` | `{ session_key }` |
| `chat_abort` | `run_id: String` | `{ run_id }` |
| `sessions_list` | (none) | `{}` |
| `sessions_resolve` | `session_key: String` | `{ session_key }` |
| `sessions_reset` | `session_key: String` | `{ session_key }` |
| `sessions_delete` | `session_key: String` | `{ session_key }` |
| `cron_list` | (none) | `{}` |
| `cron_status` | `cron_id: String` | `{ cron_id }` |
| `cron_add` | `params: serde_json::Value` | `{ params }` |
| `cron_update` | `params: serde_json::Value` | `{ params }` |
| `cron_remove` | `cron_id: String` | `{ cron_id }` |
| `cron_run` | `cron_id: String` | `{ cron_id }` |
| `cron_runs` | `cron_id: String` | `{ cron_id }` |
| `skills_status` | `agent_id: String` | `{ agent_id }` |
| `skills_install` | `agent_id: String, skill_name: String` | `{ agent_id, skill_name }` |
| `skills_update` | `agent_id: String, params: serde_json::Value` | `{ agent_id, params }` |
| `skills_bins` | (none) | `{}` |
| `git_log` | `workspace_path: String, limit: Option<usize>` | `{ workspace_path, limit? }` |
| `git_diff` | `workspace_path: String, old_commit_id: Option<String>, new_commit_id: Option<String>` | `{ workspace_path, old_commit_id?, new_commit_id? }` |
| `git_checkout` | `workspace_path: String, commit_id: String` | `{ workspace_path, commit_id }` |

**Update `tauri-api.ts`** accordingly — all invoke call args must use snake_case keys.

---

### FIX-2: Return Type Contracts

**Problem**: Rust commands return `Result<serde_json::Value, AppError>` but TS wrappers claim concrete types like `Agent[]`. The Gateway response shapes are undocumented.

**Resolution**: Since we don't fully control Gateway response shapes, keep Rust returning `serde_json::Value` but document the expected shape. TS wrappers should type as `unknown` and add runtime validation at the store/hook level, OR implement Rust-side typed deserialization.

**Decision: Rust-side typed response structs for known shapes, pass-through Value for dynamic shapes.**

Add to `gateway/protocol.rs`:
```rust
/// agents.list response
#[derive(Debug, Deserialize, Serialize)]
pub struct AgentInfo {
    pub id: String,
    pub name: String,
    pub model: String,
    pub workspace: String,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub bindings: Option<Vec<serde_json::Value>>,
}

/// config.get response
#[derive(Debug, Deserialize, Serialize)]
pub struct ConfigResponse {
    pub config: serde_json::Value,
    pub hash: String,
}

/// chat.send response
#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatSendResponse {
    pub run_id: String,
    pub status: String,
}
```

Update IPC commands to deserialize and return typed structs:
```rust
#[tauri::command]
pub async fn list_agents(state: State<'_, AppState>) -> Result<Vec<AgentInfo>, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    let value = gw.send_request("agents.list", None).await?;
    let agents: Vec<AgentInfo> = serde_json::from_value(value)?;
    Ok(agents)
}
```

For commands where the response shape is truly dynamic (cron, skills), keep `serde_json::Value` and have TS handle it as `unknown`.

---

### FIX-3: Reconnect Loop Deadlock Fix

**Problem**: The broadcast receiver `rx.recv()` can hang forever when the WS reader task ends, because the `broadcast_tx` (owned by `GatewayClient`) stays alive. The reconnect loop never resumes.

**Resolution**: Add a `close_notify` channel to `GatewayClient`. The reader task signals it on exit. The reconnect loop `select!`s between broadcast forwarding and the close signal.

**Replace the reconnect loop broadcast forwarding section with:**
```rust
// In GatewayClient — add:
pub struct GatewayClient {
    // ... existing fields ...
    closed: Arc<Notify>,  // signaled when reader loop exits
}

// In GatewayClient::connect() — update reader task:
let closed = Arc::new(Notify::new());
let closed_clone = closed.clone();
let reader_handle = tokio::spawn(async move {
    while let Some(Ok(msg)) = stream.next().await {
        // ... existing message handling ...
    }
    tracing::info!("WS reader loop ended");
    closed_clone.notify_waiters(); // Signal connection closed
});

// In GatewayClient — add method:
pub fn closed(&self) -> &Notify {
    &self.closed
}
```

**Update reconnect loop:**
```rust
// Forward broadcasts as Tauri events, with close detection
loop {
    tokio::select! {
        result = rx.recv() => {
            match result {
                Ok(bcast) => {
                    let event_name = format!("gw:{}", bcast.method);
                    let _ = app_handle.emit(&event_name, bcast.params.clone());
                }
                Err(broadcast::error::RecvError::Closed) => break,
                Err(broadcast::error::RecvError::Lagged(n)) => {
                    tracing::warn!("Broadcast lagged by {n} messages");
                }
            }
        }
        _ = gw.closed().notified() => {
            tracing::warn!("Gateway connection closed, reconnecting");
            break;
        }
    }
}
```

**Also**: On disconnect, fail all pending requests:
```rust
// In GatewayClient — add method:
pub fn fail_pending(&self) {
    self.pending.retain(|_, sender| {
        // Can't send error through oneshot<GatewayResponse>, so just drop them
        false  // remove all — senders will get RecvError
    });
}
```

Call `gw.fail_pending()` in the reconnect loop before clearing the client slot.

---

### FIX-4: Double AppState Manage

**Problem**: Phase 1 shows `.manage(AppState::new())` in `lib.rs`, then Phase 2 adds `app.manage(AppState { gateway: client })` in `.setup()`. Tauri panics if you manage the same type twice.

**Resolution**: Remove `.manage()` from Phase 1's `lib.rs`. AppState is created and managed exclusively in `.setup()`.

**Corrected `lib.rs`:**
```rust
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter("openclaw_desktop=debug")
        .init();

    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle().clone();
            let manager = ReconnectManager::new(
                "ws://127.0.0.1:18789".to_string(),
                "admin-token".to_string(), // TODO: read from config/env
            );
            let client = manager.start(handle);
            app.manage(AppState { gateway: client });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // ... all commands ...
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

For Phase 1, before the gateway is implemented, use a temporary stub:
```rust
// Phase 1 only — remove when Phase 2 is done
.setup(|app| {
    app.manage(AppState::new());
    Ok(())
})
```

---

### FIX-5: Missing Rust Imports

All Rust code blocks in the plan assume certain imports. Implementers MUST add these:

**`gateway/reconnect.rs`**: Add `use tokio::sync::broadcast;` for `broadcast::error::RecvError`.

**`gateway/client.rs`**: Add `use tokio::sync::Notify;` for close signal.

**All `commands/*.rs`**: Add:
```rust
use tauri::State;
use crate::state::AppState;
use crate::error::AppError;
```

**`lib.rs`** (for emit): Tauri v2 requires `use tauri::Emitter;` trait in scope for `app_handle.emit()`.

**`gateway/reconnect.rs`**: Add `use tauri::Emitter;` for `app_handle.emit()`.

---

### FIX-6: Missing MVP Features

The following features from the design doc are missing or incomplete in the plan. Add these to the relevant phases:

#### 6a. Agent Dashboard — Binding Info + Status
Update `Agents.tsx` (Step 3.4) to show:
- Agent status (from Gateway response)
- Binding info (channel → agent routing)

Requires: `Agent` type to include `status` and `bindings` fields (see FIX-2 `AgentInfo` struct).

#### 6b. Auto Git Commit After File Save
Add to `set_agent_file` command (Step 2.5):
```rust
#[tauri::command]
pub async fn set_agent_file(
    state: State<'_, AppState>,
    agent_id: String,
    filename: String,
    content: String,
) -> Result<serde_json::Value, AppError> {
    let lock = state.gateway.read().await;
    let gw = lock.as_ref().ok_or(AppError::NotConnected)?;
    let result = gw.send_request(
        "agents.files.set",
        Some(serde_json::json!({
            "agentId": agent_id,
            "filename": filename,
            "content": content
        })),
    ).await?;

    // Auto git commit after successful save
    // Get workspace path from agents.list cache or pass it as param
    // For now, accept workspace_path as an additional parameter
    // TODO: resolve workspace from agent_id
    Ok(result)
}
```

**Better approach**: Add `workspace_path` parameter to `set_agent_file`, and call `git::commit_all` after successful Gateway write:
```rust
#[tauri::command]
pub async fn set_agent_file(
    state: State<'_, AppState>,
    agent_id: String,
    filename: String,
    content: String,
    workspace_path: Option<String>,
) -> Result<serde_json::Value, AppError> {
    // ... send to gateway ...
    
    // Auto git commit (non-blocking, errors logged but not propagated)
    if let Some(wp) = workspace_path {
        let msg = format!("Update {filename}");
        tokio::task::spawn_blocking(move || {
            if let Err(e) = crate::git::commit_all(&wp, &msg) {
                tracing::warn!("Auto git commit failed: {e}");
            }
        });
    }
    
    Ok(result)
}
```

#### 6c. Config Editor — Visual Editing (Not Just Raw JSON)
The design doc specifies a visual editor for `agents.list` and `bindings`. The raw JSON textarea (Step 3.10) is acceptable for MVP **only if** you add a clear TODO comment and a Phase 5+ enhancement step. 

At minimum, add these to Phase 5:
- Parse config JSON, extract `agents.list` array, render as editable table
- Parse `bindings` object, render channel→agent routing rules as form
- Use `config.schema` response to validate before submit

#### 6d. Cron — Add/Edit Form + Run History
Add to Cron page (Step 3.11):
- "Add Job" dialog/form with fields: name, schedule, agentId, message
- "Edit" button per job → same form pre-filled
- "History" expand per job → call `cron.runs(cronId)` and display run list
- Show per-job status via `cron.status(cronId)`

#### 6e. Skills — apiKey/env Editing + System Binaries
Add to SkillsPanel (Step 3.7):
- For each skill card, show editable `apiKey` and `env` fields
- "Save" button per skill → calls `skills.update` with updated apiKey/env
- At top of panel, show required system binaries from `skills.bins()` with installed/missing indicator

---

### FIX-7: Corrected Implementation Order

| Order | Steps | Deliverable | Depends On |
|-------|-------|-------------|------------|
| 1 | 1.1-1.6 | Tauri v2 skeleton with routing | Nothing |
| 2 | 2.1-2.3 | Gateway client + reconnect | Order 1 |
| 3 | 2.4-2.12 | All IPC commands | Order 2 |
| 4 | 2.11 | Git manager (local, no gateway) | Order 1 |
| 5 | 2.13 | Rust tests | Order 3 + 4 |
| 6 | 3.1-3.2 | tauri-api + zustand stores | Order 3 |
| 7 | 3.3-3.11 | All pages + components | Order 6 |
| 8 | 4.1-4.4 | MCP editor + chat polish | Order 7 |
| 9 | 5.1-5.6 | Error handling + UX polish | Order 8 |
| 10 | 6.1-6.3 | Testing | Order 9 |

Note: Orders 3 and 4 can run in parallel (git manager has no gateway dependency).

---

### WARN-1: Frontend Path Aliases

Add to Step 1.3 explicitly:

**`vite.config.ts`** — add resolve alias:
```ts
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

**`tsconfig.json`** — add paths:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

**Verification**: `import { Button } from "@/components/ui/button"` resolves without errors.

---

### WARN-2: Use HashRouter Instead of BrowserRouter

**Problem**: `BrowserRouter` uses HTML5 history API which breaks in Tauri packaged apps when refreshing or deep-linking.

**Resolution**: Replace `BrowserRouter` with `HashRouter` in `App.tsx`:
```tsx
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        {/* ... same routes ... */}
      </Routes>
    </HashRouter>
  );
}
```

---

### WARN-3: TOOLS.md Content Preservation

**Problem**: `serializeToolsMd()` rewrites the entire file, clobbering non-MCP content.

**Resolution**: Instead of full rewrite, replace only the MCP section:
```ts
function updateToolsMd(originalContent: string, servers: McpServer[]): string {
  const mcpSection = serializeMcpSection(servers);
  
  // Find existing MCP section
  const mcpHeaderRegex = /## MCP Servers[\s\S]*$/;
  if (mcpHeaderRegex.test(originalContent)) {
    return originalContent.replace(mcpHeaderRegex, mcpSection);
  }
  
  // No existing section — append
  return originalContent + "\n\n" + mcpSection;
}
```

Store the original TOOLS.md content in component state and use `updateToolsMd` instead of `serializeToolsMd` when saving.

---

### WARN-4: Session Key Semantics

**Problem**: The plan generates client-side session keys (`${agentId}-${Date.now()}`) which may not match Gateway expectations.

**Resolution**: For new conversations, do NOT send `sessionKey` in `chat.send`. The Gateway will assign one and return it in the response. Update the tab's `sessionKey` with the Gateway-returned value:

```ts
sendMessage: async (message) => {
  // ... existing code ...
  const result = await chatApi.send(tab.agentId, message, 
    tab.isNew ? undefined : tab.sessionKey  // Don't send key for new chats
  );
  
  // Update sessionKey from Gateway response
  if (result.sessionKey) {
    const newTabs = [...get().tabs];
    newTabs[activeTabIndex] = { 
      ...newTabs[activeTabIndex], 
      sessionKey: result.sessionKey,
      runId: result.runId,
      isNew: false,
    };
    set({ tabs: newTabs });
  }
},
```

Add `isNew: boolean` to `ChatTab` interface. Set `true` when creating a new tab without an existing sessionKey.

---

### WARN-5: Sharper Verification Criteria

Add to each phase's completion criteria:

**Phase 1**:
- [ ] `import { Button } from "@/components/ui/button"` resolves (path alias works)

**Phase 2**:
- [ ] Invoking `list_agents` from browser console returns an array (not undefined/null)
- [ ] `gateway:status` event fires with value "connected" after successful handshake
- [ ] Killing Gateway process triggers "disconnected" → "reconnecting" → "connected" event sequence

**Phase 3**:
- [ ] `gw:chat` event with `state:"delta"` appends text to stream buffer
- [ ] `gw:chat` event with `state:"final"` moves buffer to messages array
- [ ] Refreshing the app at `/agents/some-id` still loads correctly (HashRouter)
