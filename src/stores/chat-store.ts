import { create } from "zustand";
import {
  chat as chatApi,
  sessions as sessionsApi,
  onChatEvent,
  type ChatEvent,
  type Session,
} from "@/lib/tauri-api";

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
  isNew: boolean;
}

interface ChatStore {
  tabs: ChatTab[];
  activeTabIndex: number;
  sessions: Session[];
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
    try {
      const result = await sessionsApi.list();
      set({ sessions: result });
    } catch {
      // Gateway may not be connected yet
    }
  },

  openTab: (agentId, sessionKey) => {
    const key = sessionKey || `new-${agentId}-${Date.now()}`;
    const isNew = !sessionKey;
    // Don't open duplicate tabs
    const existingIndex = get().tabs.findIndex((t) => t.sessionKey === key);
    if (existingIndex !== -1) {
      set({ activeTabIndex: existingIndex });
      return;
    }
    const tab: ChatTab = {
      sessionKey: key,
      agentId,
      messages: [],
      streaming: false,
      streamBuffer: "",
      runId: null,
      isNew,
    };
    set((state) => ({
      tabs: [...state.tabs, tab],
      activeTabIndex: state.tabs.length,
    }));
    if (!isNew) {
      get().loadHistory(key);
    }
  },

  closeTab: (index) => {
    set((state) => {
      const tabs = state.tabs.filter((_, i) => i !== index);
      return {
        tabs,
        activeTabIndex: Math.min(state.activeTabIndex, Math.max(0, tabs.length - 1)),
      };
    });
  },

  setActiveTab: (index) => set({ activeTabIndex: index }),

  sendMessage: async (message) => {
    const { tabs, activeTabIndex } = get();
    const tab = tabs[activeTabIndex];
    if (!tab) return;

    const userMsg: ChatMessage = {
      role: "user",
      content: message,
      timestamp: Date.now(),
    };
    const updatedTabs = [...tabs];
    updatedTabs[activeTabIndex] = {
      ...tab,
      messages: [...tab.messages, userMsg],
      streaming: true,
      streamBuffer: "",
    };
    set({ tabs: updatedTabs });

    try {
      const result = await chatApi.send(
        tab.agentId,
        message,
        tab.isNew ? undefined : tab.sessionKey,
      );
      const newTabs = [...get().tabs];
      newTabs[activeTabIndex] = {
        ...newTabs[activeTabIndex],
        runId: result.runId,
        sessionKey: result.sessionKey || newTabs[activeTabIndex].sessionKey,
        isNew: false,
      };
      set({ tabs: newTabs });
    } catch {
      const newTabs = [...get().tabs];
      newTabs[activeTabIndex] = {
        ...newTabs[activeTabIndex],
        streaming: false,
      };
      set({ tabs: newTabs });
    }
  },

  abortCurrent: async () => {
    const { tabs, activeTabIndex } = get();
    const tab = tabs[activeTabIndex];
    if (tab?.runId) {
      try {
        await chatApi.abort(tab.runId);
      } catch {
        // Ignore abort errors
      }
    }
  },

  loadHistory: async (sessionKey) => {
    try {
      const history = await chatApi.history(sessionKey);
      const messages: ChatMessage[] = (history as Record<string, unknown>[]).map((msg) => ({
        role: (msg.role as string) === "user" ? "user" as const : "assistant" as const,
        content: (msg.content as string) || (msg.text as string) || "",
        timestamp: (msg.timestamp as number) || Date.now(),
      }));
      set((state) => {
        const tabs = [...state.tabs];
        const tabIndex = tabs.findIndex((t) => t.sessionKey === sessionKey);
        if (tabIndex !== -1) {
          tabs[tabIndex] = { ...tabs[tabIndex], messages };
        }
        return { tabs };
      });
    } catch {
      // History load failure is non-critical
    }
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
        if (tab.streamBuffer) {
          tab.messages = [
            ...tab.messages,
            { role: "assistant", content: tab.streamBuffer + "\n\n[Error]", timestamp: Date.now() },
          ];
        }
        tab.streamBuffer = "";
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