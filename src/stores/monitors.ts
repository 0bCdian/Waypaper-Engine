import { create } from "zustand";
import type { Monitor, MonitorMode } from "../../electron/daemon-go-types";
import { logger } from "../utils/logger";
import { normalizeSelectedMonitors, selectedMonitorsOrderChanged } from "../utils/monitorNames";
import { daemonClient } from "@/client";
import { useSettingsStore } from "./settingsStore";
import type { UnifiedConfig } from "../../shared/types/unifiedConfig";

export interface StoreMonitor extends Monitor {
  isSelected: boolean;
}

export interface MonitorSelection {
  selectedMonitors: string[];
  mode: MonitorMode;
}

interface MonitorStore {
  monitorSelection: MonitorSelection;
  monitorsList: StoreMonitor[];
  setMonitorSelection: (value: MonitorSelection) => void;
  setMonitorsList: (monitorsList: StoreMonitor[]) => void;
  reQueryMonitors: () => Promise<void>;
}

const STORAGE_KEY = "waypaper-monitor-selection";

function loadPersistedSelection(): MonitorSelection {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { selectedMonitors: [], mode: "individual" };
    const parsed = JSON.parse(raw) as MonitorSelection;
    const mode = parsed.mode ?? "individual";
    const rawNames = Array.isArray(parsed.selectedMonitors) ? parsed.selectedMonitors : [];
    const normalized = normalizeSelectedMonitors(rawNames);
    const out: MonitorSelection = { selectedMonitors: normalized, mode };
    if (selectedMonitorsOrderChanged(rawNames, normalized)) {
      persistSelection(out);
    }
    return out;
  } catch {
    return { selectedMonitors: [], mode: "individual" };
  }
}

function persistSelection(sel: MonitorSelection) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sel));
  } catch {
    /* ignore */
  }
}

async function pushMonitorSelectionToDaemon(sel: MonitorSelection): Promise<void> {
  try {
    await daemonClient.updateConfig({
      monitors: {
        selected_monitors: sel.selectedMonitors,
        image_set_type: sel.mode,
      },
    });
  } catch (error) {
    logger.error("MonitorStore: Failed to sync normalized monitor names to daemon:", error);
  }
}

const initialSelection: MonitorSelection = loadPersistedSelection();

export const useMonitorStore = create<MonitorStore>()((set, get) => ({
  monitorSelection: initialSelection,
  monitorsList: [] as StoreMonitor[],

  async setMonitorSelection(value) {
    set({ monitorSelection: value });
    persistSelection(value);

    try {
      await daemonClient.updateConfig({
        monitors: {
          selected_monitors: value.selectedMonitors,
          image_set_type: value.mode,
        },
      });
    } catch (error) {
      logger.error("MonitorStore: Failed to save monitor config:", error);
    }
  },

  setMonitorsList(monitorsList) {
    set({ monitorsList });
  },

  async reQueryMonitors() {
    try {
      const monitors = await daemonClient.getMonitors();

      if (!Array.isArray(monitors) || monitors.length === 0) {
        logger.warn("MonitorStore: No monitors found");
        return;
      }

      const sel = get().monitorSelection;
      const rawNames = sel.selectedMonitors;
      const normalizedNames = normalizeSelectedMonitors(rawNames);
      const selectionChanged = selectedMonitorsOrderChanged(rawNames, normalizedNames);
      const effectiveSelection: MonitorSelection = selectionChanged
        ? { ...sel, selectedMonitors: normalizedNames }
        : sel;

      if (selectionChanged) {
        set({ monitorSelection: effectiveSelection });
        persistSelection(effectiveSelection);
        await pushMonitorSelectionToDaemon(effectiveSelection);
      }

      const storeMonitors: StoreMonitor[] = monitors.map((monitor) => ({
        ...monitor,
        isSelected: effectiveSelection.selectedMonitors.includes(monitor.name),
      }));

      set({ monitorsList: storeMonitors });
    } catch (error) {
      logger.error("MonitorStore: Error loading monitors:", error);
    }
  },
}));

/** The saved selection lives in the settings store's `monitors` section; mirror it here whenever it changes. */
function applyMonitorsConfig(monitors: UnifiedConfig["monitors"]): void {
  const rawSelected = monitors.selected_monitors || [];
  const selectedMonitors = normalizeSelectedMonitors(rawSelected);
  const selection: MonitorSelection = {
    selectedMonitors,
    mode: monitors.image_set_type || "individual",
  };
  useMonitorStore.setState((state) => ({
    monitorSelection: selection,
    monitorsList: state.monitorsList.map((monitor) => ({
      ...monitor,
      isSelected: selectedMonitors.includes(monitor.name),
    })),
  }));
  persistSelection(selection);
  if (selectedMonitorsOrderChanged(rawSelected, selectedMonitors)) {
    void pushMonitorSelectionToDaemon(selection);
  }
}

const initialMonitorsConfig = useSettingsStore.getState().config?.monitors;
if (initialMonitorsConfig) applyMonitorsConfig(initialMonitorsConfig);

const disposeSettingsSubscription = useSettingsStore.subscribe((state, prev) => {
  const monitors = state.config?.monitors;
  if (monitors && monitors !== prev.config?.monitors) applyMonitorsConfig(monitors);
});

if (import.meta.hot) {
  import.meta.hot.dispose(disposeSettingsSubscription);
}
