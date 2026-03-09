# OpenClaw Desktop — Design Document

**Date**: 2026-03-08
**Status**: Approved
**Author**: Brainstorming session

## Overview

A macOS desktop application for visually managing OpenClaw agents and chatting with them directly from the desktop, eliminating the need to manually edit config files or rely on Telegram for conversations.

**Target user**: Power user running OpenClaw locally, comfortable with Rust and React/TypeScript. Initially personal use, with plans to open-source later.

## Core Pain Points

1. **Workspace files invisible** — AGENTS.md, SOUL.md, etc. scattered across folders, hard to find and edit
2. **No version control** — Changes to workspace files have no history, diff, or rollback
3. **Cron management opaque** — Scheduled tasks hard to inspect and manage
4. **Manual config editing painful** — Editing `openclaw.json` by hand is error-prone
5. **No desktop chat** — Can't talk to specific agents from the computer without Telegram
6. **Skills/MCP management scattered** — Per-agent skills and MCP servers require CLI or manual file editing

## Technology Stack

- **Framework**: Tauri v2
- **Backend**: Rust (tokio async runtime)
- **Frontend**: React + TypeScript + Tailwind CSS + shadcn/ui
- **State management**: zustand
- **Markdown editing**: @uiw/react-md-editor
- **Git operations**: git2 crate (no system git dependency)
- **WS client**: tokio-tungstenite + futures-util
- **Config parsing**: json5 + serde_json

## Architecture

```
┌──────────────────────────────────────────────┐
│            OpenClaw Desktop (Tauri v2)        │
│                                              │
│  ┌────────────────────────────────────────┐   │
│  │     Frontend: React + TypeScript       │   │
│  │     UI: Tailwind CSS + shadcn/ui       │   │
│  │     Editor: @uiw/react-md-editor       │   │
│  │     State: zustand                     │   │
│  └──────────────┬─────────────────────────┘   │
│                 │ Tauri IPC                    │
│  ┌──────────────┴─────────────────────────┐   │
│  │     Rust Backend                       │   │
│  │                                        │   │
│  │  gateway_client  ── WS + reconnect     │   │
│  │  config_manager  ── JSON5 + locking    │   │
│  │  git_manager     ── git2 versioning    │   │
│  │  chat_bridge     ── streaming events   │   │
│  │  cron_manager    ── cron CRUD          │   │
│  │  skills_manager  ── per-agent skills   │   │
│  └──────────────┬─────────────────────────┘   │
│                 │ WebSocket                    │
└─────────────────┼────────────────────────────┘
                  ▼
      OpenClaw Gateway (ws://127.0.0.1:18789)
```

## Rust Backend Modules

| Module | Responsibility | Key crates |
|---|---|---|
| `gateway_client` | WS connection, request/response matching, auto-reconnect, event streaming | `tokio-tungstenite`, `futures-util` |
| `config_manager` | `config.get` → parse → UI → `config.patch` writeback with baseHash optimistic locking | `json5`, `serde_json` |
| `git_manager` | Git init/add/commit/log/diff/checkout on agent workspace directories | `git2` |
| `chat_bridge` | `chat.send` dispatch, broadcast `chat` event forwarding as Tauri events | `uuid` |
| `cron_manager` | Wraps `cron.list/status/add/update/remove/run/runs` | — |
| `skills_manager` | Wraps `skills.status/install/update` per agent | — |

## Frontend Pages

```
/                    → redirect to /agents
/agents              → Agent dashboard (list all agents)
/agents/:id          → Agent detail with tabs:
  ├─ Files           → Workspace file editor (AGENTS.md, SOUL.md, etc.)
  ├─ Skills          → Per-agent skill list, install, enable/disable, config
  ├─ MCP             → Per-agent MCP server configuration editor
  └─ History         → Git version history, diff viewer, rollback
/config              → Config editor (agents.list, bindings, channels)
/cron                → Cron task panel
/chat                → Chat panel (multi-tab, multi-session)
/chat/:sessionKey    → Chat with specific session
```

## Features (MVP Scope)

### 1. Agent Dashboard

List all agents from `agents.list` with status, workspace path, and binding info.

### 2. Workspace File Editor

Visual editing of workspace files with Markdown preview:
- AGENTS.md, SOUL.md, USER.md, IDENTITY.md, TOOLS.md, HEARTBEAT.md, BOOTSTRAP.md
- MEMORY.md / memory.jsonl

**API**: `agents.files.list`, `agents.files.get`, `agents.files.set`

### 3. Workspace Git Management

Automatic version control for agent workspaces, entirely local (Rust-side, no Gateway API needed):
- Auto `git init` on first open if no `.git` exists
- Auto commit after every save via the app
- View commit log, diffs between versions, checkout/rollback

**Crate**: `git2`

### 4. Config Editor

Visual editor for `openclaw.json`:
- agents.list: add/remove/edit agents
- bindings: channel → agent routing rules
- General settings

**API**: `config.get` (with hash), `config.patch` (with baseHash), `config.schema`

### 5. Cron Management Panel

- List all cron jobs with schedule, status, last run
- Add/edit/remove jobs
- Manual trigger
- View run history

**API**: `cron.list`, `cron.status`, `cron.add`, `cron.update`, `cron.remove`, `cron.run`, `cron.runs`

### 6. Chat Panel

- Select any agent, start a conversation
- Streaming responses (token-by-token)
- Multiple session tabs
- Session reset/delete
- Chat history loading
- Abort in-flight responses

**API**: `chat.send`, `chat.history`, `chat.abort`, broadcast `chat` events, `sessions.list`, `sessions.resolve`, `sessions.reset`, `sessions.delete`

### 7. Skills Management (per-agent)

- Card-style list showing each skill's name, description, enabled/disabled status
- Toggle enable/disable
- Edit apiKey and env variables
- Install new skills by name
- View required system binaries

**API**: `skills.status` (with agentId), `skills.install`, `skills.update`, `skills.bins`

### 8. MCP Management (per-agent)

- Parse MCP server config from TOOLS.md
- Form-based editing: server name, command, args, env
- Save writes back to TOOLS.md

**API**: `agents.files.get` (TOOLS.md), `agents.files.set` (TOOLS.md)

## Gateway WS Protocol

### Methods Used

| Category | Method | Direction | Scope |
|---|---|---|---|
| Connect | `connect` | → | First message, establish identity |
| Agents | `agents.list` | → ← | read |
| | `agents.files.list` | → ← | read |
| | `agents.files.get` | → ← | read |
| | `agents.files.set` | → ← | write (admin) |
| Config | `config.get` | → ← | admin |
| | `config.patch` | → ← | admin |
| | `config.schema` | → ← | admin |
| Sessions | `sessions.list` | → ← | read |
| | `sessions.resolve` | → ← | read |
| | `sessions.reset` | → ← | admin |
| | `sessions.delete` | → ← | admin |
| Chat | `chat.send` | → ← | write |
| | `chat.abort` | → ← | write |
| | `chat.history` | → ← | read |
| | broadcast `chat` | ← | server push |
| Cron | `cron.list` | → ← | read |
| | `cron.status` | → ← | read |
| | `cron.add` | → ← | admin |
| | `cron.update` | → ← | admin |
| | `cron.remove` | → ← | admin |
| | `cron.run` | → ← | write |
| | `cron.runs` | → ← | read |
| Skills | `skills.status` | → ← | read |
| | `skills.install` | → ← | admin |
| | `skills.update` | → ← | admin |
| | `skills.bins` | → ← | read |

### Chat Streaming Flow

```
Frontend                    Rust Backend                 Gateway
   │                            │                           │
   │── invoke("chat_send") ────→│                           │
   │                            │── chat.send ─────────────→│
   │                            │←─ { runId, status:"started" }
   │                            │                           │
   │                            │←── broadcast "chat" ──────│
   │                            │    { state:"delta", text } │
   │←── event "chat:delta" ─────│                           │
   │                            │                           │
   │                            │←── broadcast "chat" ──────│
   │                            │    { state:"final", msg }  │
   │←── event "chat:complete" ──│                           │
```

### Config Optimistic Locking

```
1. config.get  → { config, hash: "abc123" }
2. User edits in UI
3. config.patch → { baseHash: "abc123", raw: "{...}" }
4. Hash mismatch → error → re-fetch + show diff → retry
```

## Error Handling

| Scenario | Handling |
|---|---|
| Gateway not running / connection failed | Connection indicator in UI, exponential backoff reconnect (1s→2s→4s→8s→30s cap) |
| WS connection dropped | Auto-reconnect + toast "Reconnecting..." |
| config.patch baseHash conflict | Re-fetch config.get, show "Config modified externally" with diff |
| agents.files.set failure | Toast error, skip git commit |
| chat.send timeout | Show timeout prompt, allow chat.abort |
| git2 operation failure | Toast error, don't block main flow (git is supplementary) |
| Invalid skill install | Display Gateway error message |

## Testing Strategy

| Layer | Tool | Coverage |
|---|---|---|
| Rust unit tests | `cargo test` | Protocol serde, config parsing, git operations |
| Rust integration tests | `cargo test` + mock WS server | Gateway client connect/reconnect/request matching |
| Frontend unit tests | Vitest + React Testing Library | Component rendering, hooks logic |
| E2E | Manual (MVP phase) | Real Gateway → full flow verification |

MVP phase: focus on Rust WS client and config management module tests.

## Out of Scope (YAGNI)

- Channel connection management (WhatsApp login, Telegram setup — use CLI)
- Remote Gateway support (local only)
- Mobile apps
- Skills marketplace / discovery
- Node pairing / multi-node management

## Project Structure

```
openclaw-desktop/
├── src-tauri/
│   ├── Cargo.toml
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs
│   │   ├── gateway/
│   │   │   ├── mod.rs
│   │   │   ├── client.rs
│   │   │   ├── protocol.rs
│   │   │   └── reconnect.rs
│   │   ├── commands/
│   │   │   ├── mod.rs
│   │   │   ├── agents.rs
│   │   │   ├── config.rs
│   │   │   ├── chat.rs
│   │   │   ├── cron.rs
│   │   │   ├── sessions.rs
│   │   │   └── skills.rs
│   │   ├── git/
│   │   │   └── mod.rs
│   │   └── state.rs
│   └── tauri.conf.json
├── src/
│   ├── App.tsx
│   ├── pages/
│   │   ├── Agents.tsx
│   │   ├── AgentDetail.tsx
│   │   ├── Config.tsx
│   │   ├── Cron.tsx
│   │   ├── Chat.tsx
│   │   └── Settings.tsx
│   ├── components/
│   │   ├── AgentCard.tsx
│   │   ├── BindingEditor.tsx
│   │   ├── FileEditor.tsx
│   │   ├── SkillCard.tsx
│   │   ├── McpEditor.tsx
│   │   ├── CronJobCard.tsx
│   │   ├── ChatMessage.tsx
│   │   └── ChatInput.tsx
│   ├── hooks/
│   │   ├── useGateway.ts
│   │   ├── useAgents.ts
│   │   ├── useChat.ts
│   │   ├── useCron.ts
│   │   └── useSkills.ts
│   └── lib/
│       └── tauri-api.ts
├── package.json
└── vite.config.ts
```

## Development Phases

| Phase | Scope | Estimate |
|---|---|---|
| 1. Skeleton | Tauri v2 init, Rust WS client, agents.list display | 1-2 days |
| 2. Agent Management | CRUD agents, workspace file editor, git versioning | 3-5 days |
| 3. Config & Cron | Config visual editor, cron panel | 2-3 days |
| 4. Chat | Streaming chat, multi-session tabs | 3-5 days |
| 5. Skills & MCP | Per-agent skill management, MCP config editor | 2-3 days |
| 6. Polish | Reconnect UX, error handling, macOS native menu & notifications | 2-3 days |

## Key Dependencies (Cargo.toml)

```toml
[dependencies]
tauri = { version = "2", features = ["macos-private-api"] }
tokio = { version = "1", features = ["full"] }
tokio-tungstenite = { version = "0.24", features = ["native-tls"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
json5 = "0.4"
uuid = { version = "1", features = ["v4"] }
anyhow = "1"
futures-util = "0.3"
git2 = "0.19"
```
