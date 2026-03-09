import { create } from "zustand";
import { config as api } from "@/lib/tauri-api";

interface ConfigStore {
  raw: string;
  hash: string;
  loading: boolean;
  saving: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  save: (raw: string) => Promise<{ success: boolean; conflict?: boolean }>;
}

export const useConfigStore = create<ConfigStore>((set, get) => ({
  raw: "",
  hash: "",
  loading: false,
  saving: false,
  error: null,
  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const result = await api.get();
      set({
        raw: JSON.stringify(result.config, null, 2),
        hash: result.hash,
        loading: false,
      });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },
  save: async (raw: string) => {
    const { hash } = get();
    set({ saving: true, error: null });
    try {
      await api.patch(hash, raw);
      // Re-fetch to get new hash
      const result = await api.get();
      set({
        raw: JSON.stringify(result.config, null, 2),
        hash: result.hash,
        saving: false,
      });
      return { success: true };
    } catch (e) {
      const errMsg = String(e);
      set({ saving: false });
      if (errMsg.includes("hash") || errMsg.includes("conflict") || errMsg.includes("mismatch")) {
        // Re-fetch on conflict
        await get().fetch();
        return { success: false, conflict: true };
      }
      set({ error: errMsg });
      return { success: false };
    }
  },
}));