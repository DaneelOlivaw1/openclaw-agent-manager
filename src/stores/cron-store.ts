import { create } from "zustand";
import { cron as api, type CronJob } from "@/lib/tauri-api";

interface CronStore {
  jobs: CronJob[];
  loading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  run: (cronId: string) => Promise<void>;
  remove: (cronId: string) => Promise<void>;
}

export const useCronStore = create<CronStore>((set, get) => ({
  jobs: [],
  loading: false,
  error: null,
  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const result = await api.list();
      set({ jobs: result, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },
  run: async (cronId) => {
    await api.run(cronId);
    await get().fetch();
  },
  remove: async (cronId) => {
    await api.remove(cronId);
    await get().fetch();
  },
}));