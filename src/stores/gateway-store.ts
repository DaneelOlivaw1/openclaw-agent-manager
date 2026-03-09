import { create } from "zustand";
import { onGatewayStatus } from "@/lib/tauri-api";

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