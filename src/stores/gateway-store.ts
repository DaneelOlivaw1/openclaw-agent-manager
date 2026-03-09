import { create } from "zustand";
import { onGatewayStatus, getGatewayStatus } from "@/lib/tauri-api";

type GatewayStatus = "connecting" | "connected" | "disconnected" | "reconnecting";

interface GatewayStore {
  status: GatewayStatus;
  setStatus: (status: GatewayStatus) => void;
  init: () => void;
}

let initialized = false;

export const useGatewayStore = create<GatewayStore>((set) => ({
  status: "disconnected",
  setStatus: (status) => set({ status }),
  init: () => {
    if (initialized) return;
    initialized = true;

    // Await listener registration before polling to prevent race condition
    onGatewayStatus((status) => {
      set({ status: status as GatewayStatus });
    }).then(() => {
      getGatewayStatus()
        .then((status) => set({ status: status as GatewayStatus }))
        .catch(() => {});
    });

    // Retry polls — gateway may connect after initial poll
    const retryDelays = [500, 1500, 3000, 5000];
    for (const delay of retryDelays) {
      setTimeout(() => {
        getGatewayStatus()
          .then((status) => set({ status: status as GatewayStatus }))
          .catch(() => {});
      }, delay);
    }
  },
}));