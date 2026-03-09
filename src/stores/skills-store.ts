import { create } from "zustand";
import { skills as api, type SkillInfo } from "@/lib/tauri-api";

interface SkillsStore {
  skills: SkillInfo[];
  loading: boolean;
  error: string | null;
  currentAgentId: string | null;
  fetch: (agentId: string) => Promise<void>;
  install: (agentId: string, skillName: string) => Promise<void>;
}

export const useSkillsStore = create<SkillsStore>((set, get) => ({
  skills: [],
  loading: false,
  error: null,
  currentAgentId: null,
  fetch: async (agentId) => {
    set({ loading: true, error: null, currentAgentId: agentId });
    try {
      const result = await api.status(agentId);
      set({ skills: result, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },
  install: async (agentId, skillName) => {
    await api.install(agentId, skillName);
    await get().fetch(agentId);
  },
}));