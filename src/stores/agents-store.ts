import { create } from "zustand";
import { agents as api, type Agent } from "@/lib/tauri-api";

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