import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAgentsStore } from "@/stores/agents-store";
import { agents as api } from "@/lib/tauri-api";

vi.mock("@/lib/tauri-api", () => ({
  agents: {
    list: vi.fn(),
  },
}));

describe("agents store", () => {
  beforeEach(() => {
    useAgentsStore.setState({ agents: [], loading: false, error: null });
    vi.clearAllMocks();
  });

  it("starts with empty agents", () => {
    expect(useAgentsStore.getState().agents).toEqual([]);
    expect(useAgentsStore.getState().loading).toBe(false);
  });

  it("fetches agents successfully", async () => {
    const mockAgents = [
      { id: "a1", name: "Agent One", model: "gpt-4" },
      { id: "a2", name: "Agent Two", model: "claude-3" },
    ];
    vi.mocked(api.list).mockResolvedValueOnce(mockAgents);

    await useAgentsStore.getState().fetch();

    expect(useAgentsStore.getState().agents).toEqual(mockAgents);
    expect(useAgentsStore.getState().loading).toBe(false);
    expect(useAgentsStore.getState().error).toBeNull();
  });

  it("handles fetch error", async () => {
    vi.mocked(api.list).mockRejectedValueOnce(new Error("Connection failed"));

    await useAgentsStore.getState().fetch();

    expect(useAgentsStore.getState().agents).toEqual([]);
    expect(useAgentsStore.getState().loading).toBe(false);
    expect(useAgentsStore.getState().error).toContain("Connection failed");
  });

  it("sets loading state during fetch", async () => {
    let resolveFetch: (value: any) => void;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    vi.mocked(api.list).mockReturnValueOnce(fetchPromise as any);

    const fetchCall = useAgentsStore.getState().fetch();
    
    expect(useAgentsStore.getState().loading).toBe(true);
    
    resolveFetch!([]);
    await fetchCall;
    
    expect(useAgentsStore.getState().loading).toBe(false);
  });
});
