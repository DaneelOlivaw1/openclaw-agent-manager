import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { listen as tauriListen, type UnlistenFn } from "@tauri-apps/api/event";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri) {
    console.warn(`[tauri-api] invoke("${cmd}") skipped — not running inside Tauri`);
    return Promise.reject(new Error(`Tauri IPC unavailable (command: ${cmd}). Run with "npm run tauri dev" for full functionality.`));
  }
  return tauriInvoke<T>(cmd, args);
}

function listen<T>(event: string, handler: (event: { payload: T }) => void): Promise<UnlistenFn> {
  if (!isTauri) {
    console.warn(`[tauri-api] listen("${event}") skipped — not running inside Tauri`);
    return Promise.resolve(() => {});
  }
  return tauriListen<T>(event, handler);
}

// ============ Types ============

export interface Agent {
  id: string;
  name?: string;
  identity?: {
    name?: string;
    theme?: string;
    emoji?: string;
    avatar?: string;
    avatarUrl?: string;
  };
}

export interface AgentFile {
  name: string;
  path: string;
  missing: boolean;
  size?: number;
  updatedAtMs?: number;
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
  sessionKey: string;
  seq: number;
  state: "delta" | "final" | "aborted" | "error";
  message?: {
    role: string;
    content: Array<{ type: string; text: string }>;
    timestamp?: number;
  };
  errorMessage?: string;
}

export type CronSchedule =
  | { kind: "at"; atMs: number }
  | { kind: "every"; everyMs: number; anchorMs?: number }
  | { kind: "cron"; expr: string; tz?: string };

export interface CronJob {
  id: string;
  name: string;
  schedule: CronSchedule;
  agentId?: string;
  enabled: boolean;
  description?: string;
  state?: {
    nextRunAtMs?: number;
    lastRunAtMs?: number;
    lastStatus?: string;
    lastError?: string;
  };
}

export interface SkillConfigCheck {
  path: string;
  value: unknown;
  satisfied: boolean;
}

export interface SkillInstallOption {
  id: string;
  kind: string;
  label: string;
  bins: string[];
}

export interface SkillInfo {
  name: string;
  description: string;
  source: string;
  filePath: string;
  baseDir: string;
  skillKey: string;
  primaryEnv?: string;
  emoji?: string;
  homepage?: string;
  always: boolean;
  disabled: boolean;
  blockedByAllowlist: boolean;
  eligible: boolean;
  requirements: {
    bins: string[];
    anyBins: string[];
    env: string[];
    config: string[];
    os: string[];
  };
  missing: {
    bins: string[];
    anyBins: string[];
    env: string[];
    config: SkillConfigCheck[];
    os: string[];
  };
  configChecks: SkillConfigCheck[];
  install: SkillInstallOption[];
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
    invoke<AgentFile[]>("get_agent_files", { agentId }),
  fileGet: (agentId: string, filename: string) =>
    invoke<string>("get_agent_file", { agentId, filename }),
  fileSet: (
    agentId: string,
    filename: string,
    content: string,
    workspacePath?: string,
  ) =>
    invoke<void>("set_agent_file", {
      agentId,
      filename,
      content,
      workspacePath,
    }),
  mcpGet: (agentId: string) =>
    invoke<string>("get_agent_mcp_config", { agentId }),
  mcpSet: (agentId: string, content: string) =>
    invoke<void>("set_agent_mcp_config", { agentId, content }),
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
  send: (sessionKey: string, message: string, idempotencyKey: string) =>
    invoke<{ runId: string; status: string }>("chat_send", {
      sessionKey,
      message,
      idempotencyKey,
    }),
  history: (sessionKey: string) =>
    invoke<{ sessionKey: string; sessionId: string; messages: unknown[]; thinkingLevel: string }>("chat_history", { sessionKey }),
  abort: (sessionKey: string, runId?: string) =>
    invoke<void>("chat_abort", { sessionKey, runId }),
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
  status: (cronId: string) =>
    invoke<CronJob>("cron_status", { cronId }),
  add: (params: Partial<CronJob>) =>
    invoke<CronJob>("cron_add", { params }),
  update: (params: Partial<CronJob>) =>
    invoke<void>("cron_update", { params }),
  remove: (cronId: string) =>
    invoke<void>("cron_remove", { cronId }),
  run: (cronId: string) => invoke<void>("cron_run", { cronId }),
  runs: (cronId: string) =>
    invoke<unknown[]>("cron_runs", { cronId }),
};

// ============ Skills ============

export const skills = {
  status: (agentId: string) =>
    invoke<SkillInfo[]>("skills_status", { agentId }),
  install: (agentId: string, skillName: string) =>
    invoke<void>("skills_install", { agentId, skillName }),
  update: (params: { skillKey: string; enabled?: boolean; apiKey?: string; env?: Record<string, string> }) =>
    invoke<{ ok: boolean; skillKey: string }>("skills_update", { params }),
  bins: () => invoke<Record<string, boolean>>("skills_bins"),
  fileGet: (filePath: string) =>
    invoke<string>("skills_file_get", { filePath }),
  fileSet: (filePath: string, content: string) =>
    invoke<void>("skills_file_set", { filePath, content }),
};

// ============ Git ============

export const git = {
  log: (workspacePath: string, limit?: number) =>
    invoke<CommitInfo[]>("git_log", { workspacePath, limit }),
  diff: (
    workspacePath: string,
    oldCommitId?: string,
    newCommitId?: string,
  ) =>
    invoke<DiffInfo[]>("git_diff", {
      workspacePath,
      oldCommitId,
      newCommitId,
    }),
  checkout: (workspacePath: string, commitId: string) =>
    invoke<void>("git_checkout", {
      workspacePath,
      commitId,
    }),
};

// ============ Events ============

export function onGatewayStatus(
  callback: (status: string) => void,
): Promise<UnlistenFn> {
  return listen<string>("gateway:status", (event) => callback(event.payload));
}

export function getGatewayStatus(): Promise<string> {
  return invoke<string>("gateway_status");
}

export function onChatEvent(
  callback: (event: ChatEvent) => void,
): Promise<UnlistenFn> {
  return listen<ChatEvent>("gw:chat", (event) => callback(event.payload));
}
