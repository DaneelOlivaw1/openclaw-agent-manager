import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

// ============ Types ============

export interface Agent {
  id: string;
  name: string;
  model: string;
  workspace?: string;
  status?: string;
  bindings?: unknown[];
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
// NOTE: All invoke keys use snake_case to match Rust param names exactly

export const agents = {
  list: () => invoke<Agent[]>("list_agents"),
  filesList: (agentId: string) =>
    invoke<string[]>("get_agent_files", { agent_id: agentId }),
  fileGet: (agentId: string, filename: string) =>
    invoke<string>("get_agent_file", { agent_id: agentId, filename }),
  fileSet: (
    agentId: string,
    filename: string,
    content: string,
    workspacePath?: string,
  ) =>
    invoke<void>("set_agent_file", {
      agent_id: agentId,
      filename,
      content,
      workspace_path: workspacePath,
    }),
};

// ============ Config ============

export const config = {
  get: () => invoke<ConfigData>("config_get"),
  patch: (baseHash: string, raw: string) =>
    invoke<void>("config_patch", { base_hash: baseHash, raw }),
  schema: () => invoke<Record<string, unknown>>("config_schema"),
};

// ============ Chat ============

export const chat = {
  send: (agentId: string, message: string, sessionKey?: string) =>
    invoke<{ runId: string; sessionKey?: string }>("chat_send", {
      agent_id: agentId,
      message,
      session_key: sessionKey,
    }),
  history: (sessionKey: string) =>
    invoke<unknown[]>("chat_history", { session_key: sessionKey }),
  abort: (runId: string) => invoke<void>("chat_abort", { run_id: runId }),
};

// ============ Sessions ============

export const sessions = {
  list: () => invoke<Session[]>("sessions_list"),
  resolve: (sessionKey: string) =>
    invoke<Session>("sessions_resolve", { session_key: sessionKey }),
  reset: (sessionKey: string) =>
    invoke<void>("sessions_reset", { session_key: sessionKey }),
  delete: (sessionKey: string) =>
    invoke<void>("sessions_delete", { session_key: sessionKey }),
};

// ============ Cron ============

export const cron = {
  list: () => invoke<CronJob[]>("cron_list"),
  status: (cronId: string) =>
    invoke<CronJob>("cron_status", { cron_id: cronId }),
  add: (params: Partial<CronJob>) =>
    invoke<CronJob>("cron_add", { params }),
  update: (params: Partial<CronJob>) =>
    invoke<void>("cron_update", { params }),
  remove: (cronId: string) =>
    invoke<void>("cron_remove", { cron_id: cronId }),
  run: (cronId: string) => invoke<void>("cron_run", { cron_id: cronId }),
  runs: (cronId: string) =>
    invoke<unknown[]>("cron_runs", { cron_id: cronId }),
};

// ============ Skills ============

export const skills = {
  status: (agentId: string) =>
    invoke<SkillInfo[]>("skills_status", { agent_id: agentId }),
  install: (agentId: string, skillName: string) =>
    invoke<void>("skills_install", { agent_id: agentId, skill_name: skillName }),
  update: (agentId: string, params: Partial<SkillInfo>) =>
    invoke<void>("skills_update", { agent_id: agentId, params }),
  bins: () => invoke<Record<string, boolean>>("skills_bins"),
};

// ============ Git ============

export const git = {
  log: (workspacePath: string, limit?: number) =>
    invoke<CommitInfo[]>("git_log", { workspace_path: workspacePath, limit }),
  diff: (
    workspacePath: string,
    oldCommitId?: string,
    newCommitId?: string,
  ) =>
    invoke<DiffInfo[]>("git_diff", {
      workspace_path: workspacePath,
      old_commit_id: oldCommitId,
      new_commit_id: newCommitId,
    }),
  checkout: (workspacePath: string, commitId: string) =>
    invoke<void>("git_checkout", {
      workspace_path: workspacePath,
      commit_id: commitId,
    }),
};

// ============ Events ============

export function onGatewayStatus(
  callback: (status: string) => void,
): Promise<UnlistenFn> {
  return listen<string>("gateway:status", (event) => callback(event.payload));
}

export function onChatEvent(
  callback: (event: ChatEvent) => void,
): Promise<UnlistenFn> {
  return listen<ChatEvent>("gw:chat", (event) => callback(event.payload));
}
