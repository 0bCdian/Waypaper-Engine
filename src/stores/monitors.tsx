import { create } from "zustand";
import { type Monitor, type ActiveMonitor } from "../../shared/types/monitor";
import { type DaemonMonitorInfo } from "../../shared/types/daemonEvents";
import { type PartialConfig } from "../types/ipc";

export interface StoreMonitor extends Monitor {
	isSelected: boolean;
}

interface MonitorStore {
	activeMonitor: ActiveMonitor;
	monitorsList: StoreMonitor[];
	setActiveMonitor: (value: ActiveMonitor) => void;
	setMonitorsList: (monitorsList: StoreMonitor[]) => void;
	reQueryMonitors: () => Promise<void>;
	setLastSavedMonitorConfig: () => Promise<void>;
	// Internal method for loading without persistence
	_setActiveMonitorFromConfig: (value: ActiveMonitor) => void;
	// Internal state to prevent race conditions
	_isLoadingConfig: boolean;
}

const initialState = {
	activeMonitor: {
		name: "",
		monitors: [] as Monitor[],
		extendAcrossMonitors: false,
	},
	monitorsList: [] as StoreMonitor[],
	_isLoadingConfig: false,
};

export const useMonitorStore = create<MonitorStore>()((set, get) => ({
	activeMonitor: initialState.activeMonitor,
	monitorsList: initialState.monitorsList,
	_isLoadingConfig: initialState._isLoadingConfig,

	// PUBLIC: Set active monitor and persist to daemon (for user actions)
	async setActiveMonitor(value) {
		// Prevent persistence during loading to avoid race conditions
		if (get()._isLoadingConfig) {
			return;
		}
		set((state) => {
			return {
				...state,
				activeMonitor: value,
			};
		});

		// Persist the configuration using type-safe partial config
		try {
			const selectedMonitors = value.monitors.map((monitor) => monitor.name);
			const imageSetType = value.extendAcrossMonitors ? "extend" : "individual";

			// Create type-safe partial config
			const partialConfig: PartialConfig = {
				monitors: {
					selected_monitors: selectedMonitors,
					image_set_type: imageSetType,
				},
			};

			// No validation needed - daemon handles validation

			// Use the modern unified config API
			if (window.API_RENDERER?.goDaemon?.setBulkConfig) {
				await window.API_RENDERER.goDaemon.setBulkConfig(partialConfig);
			}
		} catch (error) {
			console.error("🔴 MonitorStore: Failed to save monitor config:", error);
		}
	},

	// Validate monitor configuration
	validateMonitorConfig(activeMonitor: ActiveMonitor): {
		isValid: boolean;
		error?: string;
	} {
		if (!activeMonitor.monitors || activeMonitor.monitors.length === 0) {
			return { isValid: false, error: "No monitors selected" };
		}

		const monitorCount = activeMonitor.monitors.length;
		const imageSetType =
			activeMonitor.imageSetType ||
			(activeMonitor.extendAcrossMonitors ? "extend" : "individual");

		if (imageSetType === "individual" && monitorCount !== 1) {
			return {
				isValid: false,
				error: "Individual mode requires exactly 1 monitor",
			};
		}

		if (
			(imageSetType === "extend" || imageSetType === "clone") &&
			monitorCount < 2
		) {
			return {
				isValid: false,
				error: "Extend/Clone mode requires at least 2 monitors",
			};
		}

		return { isValid: true };
	},
	setMonitorsList(monitorsList) {
		set((state) => {
			return {
				...state,
				monitorsList,
			};
		});
	},
	async reQueryMonitors() {
		try {
			// Check if goDaemon is available
			if (!window.API_RENDERER?.goDaemon) {
				console.error("🔴 MonitorStore: goDaemon not available");
				return;
			}

			// Check if getMonitors method exists
			if (typeof window.API_RENDERER.goDaemon.getMonitors !== "function") {
				console.error("🔴 MonitorStore: getMonitors method not available");
				return;
			}

		const monitorsResponse = await window.API_RENDERER.goDaemon.getMonitors();
		console.log("🔵 MonitorStore: Raw monitors response:", monitorsResponse);

		// Handle case where response might be an object or array
		let monitors: Monitor[] = [];
		if (Array.isArray(monitorsResponse)) {
			monitors = monitorsResponse;
		} else if (typeof monitorsResponse === "object" && monitorsResponse !== null) {
			// Convert object to array
			monitors = Object.values(monitorsResponse) as Monitor[];
		}

		if (monitors.length === 0) {
			console.warn("🟡 MonitorStore: No monitors found");
			return;
		}

		const activeMonitor = get().activeMonitor;

		// Create store monitors with proper selection state
		const storeMonitors = monitors.map((monitor: Monitor) => {
				const match = activeMonitor.monitors.find(
					(activeMonitorMonitor: Monitor) => {
						return activeMonitorMonitor.name === monitor.name;
					},
				);
				const isSelected = match !== undefined;
				return {
					...monitor,
					isSelected,
				};
			});

			set((state) => {
				return {
					...state,
					monitorsList: storeMonitors,
				};
			});
		} catch (error) {
			console.error("🔴 MonitorStore: Error loading monitors:", error);
		}
	},
	async setLastSavedMonitorConfig() {
		try {
			// Set loading flag to prevent race conditions
			set((state) => ({ ...state, _isLoadingConfig: true }));

			// Check if goDaemon is available
			if (!window.API_RENDERER?.goDaemon) {
				console.error("🔴 MonitorStore: goDaemon not available");
				return;
			}

			// Check if getMonitors method exists
			if (typeof window.API_RENDERER.goDaemon.getMonitors !== "function") {
				console.error("🔴 MonitorStore: getMonitors method not available");
				return;
			}

		// Load monitors from daemon
		const monitorsListResponse = await window.API_RENDERER.goDaemon.getMonitors();
		console.log("🔵 MonitorStore: Raw monitors list response:", monitorsListResponse);

		// Handle case where response might be an object or array
		let monitorsList: Monitor[] = [];
		if (Array.isArray(monitorsListResponse)) {
			monitorsList = monitorsListResponse;
		} else if (typeof monitorsListResponse === "object" && monitorsListResponse !== null) {
			// Convert object to array
			monitorsList = Object.values(monitorsListResponse) as Monitor[];
		}

		if (monitorsList.length === 0) {
			console.warn("🟡 MonitorStore: No monitors found for config");
			set((state) => ({ ...state, _isLoadingConfig: false }));
			return;
		}

		// Load config from unified system
			let selectedMonitors: string[] = [];
			let imageSetType: string = "individual";

			if (window.API_RENDERER?.goDaemon?.getConfig) {
				const config = await window.API_RENDERER.goDaemon.getConfig();

				// Extract monitor configuration from the unified config
				if (config && config.monitors) {
					selectedMonitors = config.monitors.selected_monitors || [];
					imageSetType = config.monitors.image_set_type || "individual";
				}
			}

			if (selectedMonitors.length > 0) {
				// Find the selected monitors in the current monitor list
				const selectedMonitorObjects = monitorsList.filter((monitor: Monitor) =>
					selectedMonitors.includes(monitor.name),
				);

				if (selectedMonitorObjects.length > 0) {
					// Create active monitor configuration
					const activeMonitor: ActiveMonitor = {
						name: selectedMonitorObjects
							.map((m: DaemonMonitorInfo) => m.name)
							.join(","),
						monitors: selectedMonitorObjects,
						extendAcrossMonitors: imageSetType === "extend",
						imageSetType: imageSetType, // Include the actual mode for the modal
					};

					// Set the active monitor configuration (without triggering persistence)
					get()._setActiveMonitorFromConfig(activeMonitor);

					// Create store monitors with proper selection state
					const storeMonitors = monitorsList.map((monitor: Monitor) => {
						const isSelected = selectedMonitors.includes(monitor.name);
						return {
							...monitor,
							isSelected,
						};
					});

					get().setMonitorsList(storeMonitors);
				} else {
					// Selected monitors no longer exist, reset to default
					get()._setActiveMonitorFromConfig(initialState.activeMonitor);
					const storeMonitors = monitorsList.map((monitor: Monitor) => ({
						...monitor,
						isSelected: false,
					}));
					get().setMonitorsList(storeMonitors);
				}
			} else {
				// No saved config, set default state
				get()._setActiveMonitorFromConfig(initialState.activeMonitor);
				const storeMonitors = monitorsList.map((monitor: Monitor) => ({
					...monitor,
					isSelected: false,
				}));
				get().setMonitorsList(storeMonitors);
			}
		} catch (error) {
			console.error(
				"🟡 MonitorStore: Error setting last saved monitor config:",
				error,
			);
		} finally {
			// Always clear the loading flag
			set((state) => ({ ...state, _isLoadingConfig: false }));
		}
	},

	// Internal method for loading without persistence
	_setActiveMonitorFromConfig(value) {
		set({ activeMonitor: value });
	},
}));
