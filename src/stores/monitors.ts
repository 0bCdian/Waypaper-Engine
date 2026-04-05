import { create } from "zustand";
import type { Monitor, MonitorMode } from "../../electron/daemon-go-types";
import { logger } from "../utils/logger";
import { normalizeSelectedMonitors, selectedMonitorsOrderChanged } from "../utils/monitorNames";

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
  refreshFromDaemon: () => Promise<void>;
  setLastSavedMonitorConfig: () => Promise<void>;
  _isLoadingConfig: boolean;
  _configLoaded: boolean;
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
    if (window.API_RENDERER?.goDaemon?.updateConfig) {
      await window.API_RENDERER.goDaemon.updateConfig({
        monitors: {
          selected_monitors: sel.selectedMonitors,
          image_set_type: sel.mode,
        },
      });
    }
  } catch (error) {
    logger.error("MonitorStore: Failed to sync normalized monitor names to daemon:", error);
  }
}

const initialSelection: MonitorSelection = loadPersistedSelection();

export const useMonitorStore = create<MonitorStore>()((set, get) => ({
  monitorSelection: initialSelection,
  monitorsList: [] as StoreMonitor[],
  _isLoadingConfig: false,
  _configLoaded: false,

  async setMonitorSelection(value) {
    if (get()._isLoadingConfig) return;

    set({ monitorSelection: value });
    persistSelection(value);

    try {
      if (window.API_RENDERER?.goDaemon?.updateConfig) {
        await window.API_RENDERER.goDaemon.updateConfig({
          monitors: {
            selected_monitors: value.selectedMonitors,
            image_set_type: value.mode,
          },
        });
      }
    } catch (error) {
      logger.error("MonitorStore: Failed to save monitor config:", error);
    }
  },

  setMonitorsList(monitorsList) {
    set({ monitorsList });
  },

  async reQueryMonitors() {
    try {
      if (!window.API_RENDERER?.goDaemon?.getMonitors) {
        logger.error("MonitorStore: getMonitors not available");
        return;
      }

      const monitors = await window.API_RENDERER.goDaemon.getMonitors();

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

  async refreshFromDaemon() {
    try {
      if (!window.API_RENDERER?.goDaemon?.getConfig) return;

      const [monitors, config] = await Promise.all([
        window.API_RENDERER.goDaemon.getMonitors(),
        window.API_RENDERER.goDaemon.getConfig(),
      ]);

      if (!config?.monitors) return;

      const rawSelected = config.monitors.selected_monitors || [];
      const selectedMonitors = normalizeSelectedMonitors(rawSelected);
      const mode: MonitorMode = config.monitors.image_set_type || "individual";
      const selection: MonitorSelection = { selectedMonitors, mode };
      const needsDaemonSync = selectedMonitorsOrderChanged(rawSelected, selectedMonitors);

      const storeMonitors: StoreMonitor[] = (Array.isArray(monitors) ? monitors : []).map(
        (monitor) => ({
          ...monitor,
          isSelected: selectedMonitors.includes(monitor.name),
        }),
      );

      set({ monitorSelection: selection, monitorsList: storeMonitors });
      persistSelection(selection);
      if (needsDaemonSync) {
        await pushMonitorSelectionToDaemon(selection);
      }
    } catch (error) {
      logger.error("MonitorStore: Error refreshing from daemon:", error);
    }
  },

  async setLastSavedMonitorConfig() {
    if (get()._configLoaded) return;

    try {
      set({ _isLoadingConfig: true });

      if (!window.API_RENDERER?.goDaemon) {
        logger.error("MonitorStore: goDaemon not available");
        return;
      }

      const monitors = await window.API_RENDERER.goDaemon.getMonitors();
      if (!Array.isArray(monitors) || monitors.length === 0) {
        set({ _isLoadingConfig: false });
        return;
      }

      let selectedMonitors: string[] = [];
      let imageSetType: MonitorMode = "individual";

      let rawSelectedFromDaemon: string[] = [];
      if (window.API_RENDERER.goDaemon.getConfig) {
        const config = await window.API_RENDERER.goDaemon.getConfig();
        if (config?.monitors) {
          rawSelectedFromDaemon = config.monitors.selected_monitors || [];
          selectedMonitors = normalizeSelectedMonitors(rawSelectedFromDaemon);
          imageSetType = config.monitors.image_set_type || "individual";
        }
      }

      const selection: MonitorSelection = {
        selectedMonitors,
        mode: imageSetType,
      };
      const needsDaemonSync = selectedMonitorsOrderChanged(rawSelectedFromDaemon, selectedMonitors);

      const storeMonitors: StoreMonitor[] = monitors.map((monitor) => ({
        ...monitor,
        isSelected: selectedMonitors.includes(monitor.name),
      }));

      set({
        monitorSelection: selection,
        monitorsList: storeMonitors,
        _configLoaded: true,
      });
      persistSelection(selection);
      if (needsDaemonSync) {
        await pushMonitorSelectionToDaemon(selection);
      }
    } catch (error) {
      logger.error("MonitorStore: Error setting last saved config:", error);
    } finally {
      set({ _isLoadingConfig: false });
    }
  },
}));

interface ConfigChangeEvent {
  sections?: string[];
  source?: string;
}

let _disposeConfigChanged: (() => void) | undefined;

function initMonitorConfigListener() {
  _disposeConfigChanged?.();
  if (typeof window !== "undefined" && window.API_RENDERER?.goDaemon) {
    _disposeConfigChanged = window.API_RENDERER.goDaemon.on("config_changed", (data: unknown) => {
      const event = data as ConfigChangeEvent;
      const sections = event?.sections;
      if (!sections || sections.includes("monitors")) {
        void useMonitorStore.getState().refreshFromDaemon();
      }
    });
  }
}

initMonitorConfigListener();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    _disposeConfigChanged?.();
  });
}
