import { describe, it, expect, beforeEach } from "vitest";
import { useGatewayStore } from "@/stores/gateway-store";

describe("gateway store", () => {
  beforeEach(() => {
    useGatewayStore.setState({ status: "disconnected" });
  });

  it("starts with disconnected status", () => {
    expect(useGatewayStore.getState().status).toBe("disconnected");
  });

  it("updates status", () => {
    useGatewayStore.getState().setStatus("connected");
    expect(useGatewayStore.getState().status).toBe("connected");
  });

  it("transitions through connection states", () => {
    const store = useGatewayStore.getState();
    store.setStatus("connecting");
    expect(useGatewayStore.getState().status).toBe("connecting");
    store.setStatus("connected");
    expect(useGatewayStore.getState().status).toBe("connected");
    store.setStatus("disconnected");
    expect(useGatewayStore.getState().status).toBe("disconnected");
    store.setStatus("reconnecting");
    expect(useGatewayStore.getState().status).toBe("reconnecting");
  });
});
