import { vi, describe, it, expect, beforeEach } from "vitest";
import { act } from "@testing-library/react";
import { createMockAPI } from "../../test/mocks/apiRenderer";
import { sampleMonitor } from "../../test/mocks/fixtures";
import type { MonitorSelection } from "../monitors";

const STORAGE_KEY = "waypaper-monitor-selection";

describe("useMonitorStore", () => {
  let mockAPI: ReturnType<typeof createMockAPI>;

  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    mockAPI = createMockAPI();
    Object.defineProperty(window, "API_RENDERER", {
      value: mockAPI,
      writable: true,
      configurable: true,
    });
  });

  async function getStore() {
    const mod = await import("../monitors");
    return mod.useMonitorStore;
  }

  it("initial state loads from localStorage", async () => {
    const selection: MonitorSelection = {
      selectedMonitors: ["HDMI-A-1"],
      mode: "individual",
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));

    const useMonitorStore = await getStore();
    const state = useMonitorStore.getState();

    expect(state.monitorSelection.selectedMonitors).toEqual(["HDMI-A-1"]);
    expect(state.monitorSelection.mode).toBe("individual");
  });

  it("setMonitorSelection updates state and persists", async () => {
    const useMonitorStore = await getStore();

    const newSelection: MonitorSelection = {
      selectedMonitors: ["DP-1", "DP-2"],
      mode: "extend",
    };

    await act(async () => {
      await useMonitorStore.getState().setMonitorSelection(newSelection);
    });

    const state = useMonitorStore.getState();
    expect(state.monitorSelection.selectedMonitors).toEqual(["DP-1", "DP-2"]);
    expect(state.monitorSelection.mode).toBe("extend");

    const persistedRaw = localStorage.getItem(STORAGE_KEY);
    expect(persistedRaw).not.toBeNull();
    const persisted = JSON.parse(persistedRaw ?? "{}");
    expect(persisted.selectedMonitors).toEqual(["DP-1", "DP-2"]);

    expect(mockAPI.goDaemon.updateConfig).toHaveBeenCalledWith({
      monitors: {
        selected_monitors: ["DP-1", "DP-2"],
        image_set_type: "extend",
      },
    });
  });

  it("reQueryMonitors fetches monitors and merges selection", async () => {
    const monitors = [
      sampleMonitor("HDMI-A-1"),
      sampleMonitor("DP-1", { width: 2560, height: 1440 }),
    ];
    mockAPI.goDaemon.getMonitors = vi.fn().mockResolvedValue(monitors);

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        selectedMonitors: ["HDMI-A-1"],
        mode: "individual",
      }),
    );

    const useMonitorStore = await getStore();

    await act(async () => {
      await useMonitorStore.getState().reQueryMonitors();
    });

    const state = useMonitorStore.getState();
    expect(state.monitorsList).toHaveLength(2);
    expect(state.monitorsList[0].isSelected).toBe(true);
    expect(state.monitorsList[1].isSelected).toBe(false);
  });

  it("setLastSavedMonitorConfig loads from daemon config", async () => {
    const monitors = [sampleMonitor("HDMI-A-1"), sampleMonitor("DP-1")];
    mockAPI.goDaemon.getMonitors = vi.fn().mockResolvedValue(monitors);
    mockAPI.goDaemon.getConfig = vi.fn().mockResolvedValue({
      app: {},
      daemon: {},
      backend: { type: "swww" },
      monitors: {
        selected_monitors: ["DP-1"],
        image_set_type: "individual",
      },
      wallhaven: {},
    });

    const useMonitorStore = await getStore();

    await act(async () => {
      await useMonitorStore.getState().setLastSavedMonitorConfig();
    });

    const state = useMonitorStore.getState();
    expect(state.monitorSelection.selectedMonitors).toEqual(["DP-1"]);
    expect(state.monitorsList).toHaveLength(2);
    expect(state.monitorsList[0].isSelected).toBe(false);
    expect(state.monitorsList[1].isSelected).toBe(true);
    expect(state._configLoaded).toBe(true);
  });

  it("setLastSavedMonitorConfig is idempotent after first load", async () => {
    const monitors = [sampleMonitor("HDMI-A-1")];
    mockAPI.goDaemon.getMonitors = vi.fn().mockResolvedValue(monitors);
    mockAPI.goDaemon.getConfig = vi.fn().mockResolvedValue({
      app: {},
      daemon: {},
      backend: { type: "swww" },
      monitors: {
        selected_monitors: ["HDMI-A-1"],
        image_set_type: "individual",
      },
      wallhaven: {},
    });

    const useMonitorStore = await getStore();

    await act(async () => {
      await useMonitorStore.getState().setLastSavedMonitorConfig();
    });
    expect(mockAPI.goDaemon.getMonitors).toHaveBeenCalledTimes(1);

    await act(async () => {
      await useMonitorStore.getState().setLastSavedMonitorConfig();
    });
    // Should not call getMonitors again
    expect(mockAPI.goDaemon.getMonitors).toHaveBeenCalledTimes(1);
  });
});
