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

  it("applies the monitors section from the settings store without fetching config", async () => {
    const monitors = [sampleMonitor("HDMI-A-1"), sampleMonitor("DP-1")];
    mockAPI.goDaemon.getMonitors = vi.fn().mockResolvedValue(monitors);
    const useMonitorStore = await getStore();
    const { useSettingsStore } = await import("../settingsStore");

    await act(async () => {
      await useMonitorStore.getState().reQueryMonitors();
    });
    vi.mocked(mockAPI.goDaemon.getConfig).mockClear();

    act(() => {
      useSettingsStore.setState({
        config: {
          ...(useSettingsStore.getState().config ?? ({} as never)),
          monitors: { selected_monitors: ["DP-1"], image_set_type: "individual" },
        } as never,
      });
    });

    const state = useMonitorStore.getState();
    expect(state.monitorSelection.selectedMonitors).toEqual(["DP-1"]);
    expect(state.monitorsList.map((m) => m.isSelected)).toEqual([false, true]);
    expect(mockAPI.goDaemon.getConfig).not.toHaveBeenCalled();
    expect(mockAPI.goDaemon.getMonitors).toHaveBeenCalledTimes(1);
  });

  it("ignores settings updates that leave the monitors section unchanged", async () => {
    const useMonitorStore = await getStore();
    const { useSettingsStore } = await import("../settingsStore");
    const monitorsSection = { selected_monitors: ["DP-1"], image_set_type: "individual" };
    act(() => {
      useSettingsStore.setState({ config: { app: {}, monitors: monitorsSection } as never });
    });
    const selection = useMonitorStore.getState().monitorSelection;

    act(() => {
      useSettingsStore.setState({
        config: { app: { theme: "nord" }, monitors: monitorsSection } as never,
      });
    });

    expect(useMonitorStore.getState().monitorSelection).toBe(selection);
  });
});
