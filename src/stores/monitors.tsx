import { create } from "zustand";
import type { Monitor, MonitorMode } from "../../electron/daemon-go-types";

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
	setLastSavedMonitorConfig: () => Promise<void>;
	_isLoadingConfig: boolean;
	_configLoaded: boolean;
}

const initialSelection: MonitorSelection = {
	selectedMonitors: [],
	mode: "individual",
};

export const useMonitorStore = create<MonitorStore>()((set, get) => ({
	monitorSelection: initialSelection,
	monitorsList: [] as StoreMonitor[],
	_isLoadingConfig: false,
	_configLoaded: false,

	async setMonitorSelection(value) {
		if (get()._isLoadingConfig) return;

		set({ monitorSelection: value });

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
			console.error("MonitorStore: Failed to save monitor config:", error);
		}
	},

	setMonitorsList(monitorsList) {
		set({ monitorsList });
	},

	async reQueryMonitors() {
		try {
			if (!window.API_RENDERER?.goDaemon?.getMonitors) {
				console.error("MonitorStore: getMonitors not available");
				return;
			}

			const monitors = await window.API_RENDERER.goDaemon.getMonitors();

			if (!Array.isArray(monitors) || monitors.length === 0) {
				console.warn("MonitorStore: No monitors found");
				return;
			}

			const selection = get().monitorSelection;
			const storeMonitors: StoreMonitor[] = monitors.map((monitor) => ({
				...monitor,
				isSelected: selection.selectedMonitors.includes(monitor.name),
			}));

			set({ monitorsList: storeMonitors });
		} catch (error) {
			console.error("MonitorStore: Error loading monitors:", error);
		}
	},

	async setLastSavedMonitorConfig() {
		// Only load persisted config once at startup. Subsequent calls are no-ops
		// so we don't overwrite in-session monitor selections.
		if (get()._configLoaded) return;

		try {
			set({ _isLoadingConfig: true });

			if (!window.API_RENDERER?.goDaemon) {
				console.error("MonitorStore: goDaemon not available");
				return;
			}

			const monitors = await window.API_RENDERER.goDaemon.getMonitors();
			if (!Array.isArray(monitors) || monitors.length === 0) {
				set({ _isLoadingConfig: false });
				return;
			}

			let selectedMonitors: string[] = [];
			let imageSetType: MonitorMode = "individual";

			if (window.API_RENDERER.goDaemon.getConfig) {
				const config = await window.API_RENDERER.goDaemon.getConfig();
				if (config?.monitors) {
					selectedMonitors = config.monitors.selected_monitors || [];
					imageSetType = config.monitors.image_set_type || "individual";
				}
			}

			const selection: MonitorSelection = {
				selectedMonitors,
				mode: imageSetType,
			};

			const storeMonitors: StoreMonitor[] = monitors.map((monitor) => ({
				...monitor,
				isSelected: selectedMonitors.includes(monitor.name),
			}));

			set({
				monitorSelection: selection,
				monitorsList: storeMonitors,
				_configLoaded: true,
			});
		} catch (error) {
			console.error("MonitorStore: Error setting last saved config:", error);
		} finally {
			set({ _isLoadingConfig: false });
		}
	},
}));
