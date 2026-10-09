import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockAPI } from "../../test/mocks/apiRenderer";
import { sampleMonitor } from "../../test/mocks/fixtures";

describe("useLoadMonitors", () => {
  let mockAPI: ReturnType<typeof createMockAPI>;

  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    mockAPI = createMockAPI();
    mockAPI.goDaemon.getMonitors = vi.fn().mockResolvedValue([sampleMonitor("DP-1")]);
    Object.defineProperty(window, "API_RENDERER", {
      value: mockAPI,
      writable: true,
      configurable: true,
    });
  });

  it("fetches the monitor list once and never fetches config", async () => {
    const { useLoadMonitors } = await import("../useLoadMonitors");
    const { useMonitorStore } = await import("../../stores/monitors");

    renderHook(() => useLoadMonitors());

    await waitFor(() => expect(useMonitorStore.getState().monitorsList).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 50));
    expect(mockAPI.goDaemon.getMonitors).toHaveBeenCalledTimes(1);
    expect(mockAPI.goDaemon.getConfig).not.toHaveBeenCalled();
  });
});
