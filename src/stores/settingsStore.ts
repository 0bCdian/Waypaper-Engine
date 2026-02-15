/**
 * Unified Settings Store for Waypaper Engine
 *
 * This store manages all configuration settings and syncs with the TOML file
 * via IPC channels. It serves as the single source of truth for UI state
 * while keeping the TOML file as the persistent source of truth.
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type {
	UnifiedConfig,
	ConfigSection,
	ConfigChangeEvent,
} from "../../shared/types/unifiedConfig";

interface SettingsStoreState {
	// Configuration data
	config: UnifiedConfig | null;

	// UI state
	isLoading: boolean;
	lastSaved: number | null;
	errors: Array<{ section: ConfigSection; key: string; message: string }>;

	// Search and filtering
	searchTerm: string;
	filteredSections: ConfigSection[];

	// UI preferences
	expandedSections: Set<ConfigSection>;
	showAdvancedSettings: boolean;
}

interface SettingsStoreActions {
	// Configuration management
	loadConfig: () => Promise<void>;
	saveConfig: (
		section: ConfigSection,
		key: string,
		value: unknown,
	) => Promise<void>;
	resetToDefaults: () => Promise<void>;

	// Search and filtering
	setSearchTerm: (term: string) => void;
	clearSearch: () => void;

	// UI state management
	toggleSection: (section: ConfigSection) => void;
	setShowAdvancedSettings: (show: boolean) => void;

	// Event handling
	handleConfigChange: (event: ConfigChangeEvent) => void;

	// Validation
	validateConfig: (
		config: Partial<UnifiedConfig>,
	) => Array<{ section: ConfigSection; key: string; message: string }>;
	clearErrors: () => void;
}

type SettingsStore = SettingsStoreState & SettingsStoreActions;

// Default configuration matching TOML structure
const defaultConfig: UnifiedConfig = {
	app: {
		kill_daemon_on_exit: true,
		notifications: true,
		start_minimized: false,
		minimize_instead_of_close: true,
		show_monitor_modal_on_start: false,
		images_per_page: 20,
		theme: "dark",
		sort_by: "name",
		sort_order: "asc",
		image_history_limit: 50,
	},
	daemon: {
		database_path: "~/.config/waypaper-engine/data",
		images_dir: "~/.waypaper-engine/images",
		thumbnails_dir: "~/.waypaper-engine/data/cache/thumbnails",
		monitors_state_file: "~/.cache/waypaper-engine/monitors.json",
		socket_path: "/tmp/waypaper-engine.sock",
		log_level: "info",
		log_file: "~/.config/waypaper-engine/daemon.log",
		log_max_size: 10,
		log_max_age: 7,
		log_max_backups: 3,
		compositor: "wayland",
	},
	backend: {
		type: "swww",
		swww: {
			transition_type: "simple",
			transition_step: 90,
			transition_duration: 200,
			transition_angle: 45,
			transition_pos: "center",
			transition_bezier: "0.4,0.0,0.2,1",
			transition_wave: "0,0,0,0",
		},
	},
	monitors: {
		selected_monitors: [],
		image_set_type: "individual",
	},
};

export const useSettingsStore = create<SettingsStore>()(
	devtools(
		(set, get) => ({
			// Initial state
			config: null,
			isLoading: false,
			lastSaved: null,
			errors: [],
			searchTerm: "",
			filteredSections: ["app", "daemon", "backend", "monitors"],
			expandedSections: new Set(["app"]),
			showAdvancedSettings: false,

			// Load configuration from daemon
			loadConfig: async () => {
				set({ isLoading: true, errors: [] });

				try {
					if (window.API_RENDERER?.goDaemon?.getConfig) {
						const config = await window.API_RENDERER.goDaemon.getConfig();
						set({
							config,
							isLoading: false,
							lastSaved: Date.now(),
						});
						console.log("🟢 SettingsStore: Config loaded successfully", config);
					} else {
						console.warn("🔴 SettingsStore: getConfig method not available");
						set({
							config: defaultConfig,
							isLoading: false,
						});
					}
				} catch (error) {
					console.error("🔴 SettingsStore: Failed to load config:", error);
					set({
						config: defaultConfig,
						isLoading: false,
						errors: [
							{
								section: "app",
								key: "load",
								message: "Failed to load configuration",
							},
						],
					});
				}
			},

			// Save configuration to daemon
			saveConfig: async (
				section: ConfigSection,
				key: string,
				value: unknown,
			) => {
				const currentConfig = get().config;
				if (!currentConfig) {
					console.error("🔴 SettingsStore: No config loaded");
					return;
				}

				// Validate that the key is allowed for the section
				// Window bounds and other Electron-specific settings should not be saved to Go daemon config
				const invalidKeys = ["windowBounds", "window_bounds"];
				if (invalidKeys.includes(key)) {
					console.warn(
						`🔴 SettingsStore: Attempted to save invalid config key "${key}" to section "${section}". This key is not supported by the Go daemon config.`,
					);
					return;
				}

				// Update local state optimistically first (no loading state to avoid flicker)
				const newConfig = { ...currentConfig };
				if (section === "app") {
					newConfig.app = { ...newConfig.app, [key]: value };
				} else if (section === "daemon") {
					newConfig.daemon = { ...newConfig.daemon, [key]: value };
				} else if (section === "backend") {
					if (key.startsWith("swww.")) {
						const swwwKey = key.replace("swww.", "");
						newConfig.backend.swww = {
							...newConfig.backend.swww,
							[swwwKey]: value,
						};
					} else {
						newConfig.backend = { ...newConfig.backend, [key]: value };
					}
				} else if (section === "monitors") {
					newConfig.monitors = { ...newConfig.monitors, [key]: value };
				}

				// Update config immediately for smooth UI
				set({
					config: newConfig,
					errors: [], // Clear any previous errors
				});

				try {
					if (window.API_RENDERER?.goDaemon?.setConfig) {
						// Use the correct IPC structure that matches the Go handler
						await window.API_RENDERER.goDaemon.setConfig(section, key, value);

						// Only update success state after successful save
						set({
							lastSaved: Date.now(),
						});

						console.log("🟢 SettingsStore: Config updated successfully", {
							section,
							key,
							value,
						});
					} else {
						console.warn("🔴 SettingsStore: setConfig method not available");
					}
				} catch (error) {
					console.error("🔴 SettingsStore: Failed to update config:", error);

					// Rollback the optimistic update on error
					set({
						config: currentConfig,
						errors: [{ section, key, message: `Failed to update ${key}` }],
					});
				}
			},

			// Reset to default configuration
			resetToDefaults: async () => {
				set({ isLoading: true });

				try {
					// Reset each section to defaults
					for (const [section, sectionConfig] of Object.entries(
						defaultConfig,
					)) {
						for (const [key, value] of Object.entries(sectionConfig)) {
							if (section === "backend" && key === "swww") {
								// Handle nested swww config
								for (const [swwwKey, swwwValue] of Object.entries(value as Record<string, unknown>)) {
									await get().saveConfig(
										"backend",
										`swww.${swwwKey}`,
										swwwValue,
									);
								}
							} else {
								await get().saveConfig(section as ConfigSection, key, value);
							}
						}
					}

					set({ config: defaultConfig, isLoading: false });
				} catch (error) {
					console.error("🔴 SettingsStore: Failed to reset config:", error);
					set({ isLoading: false });
				}
			},

			// Search and filtering
			setSearchTerm: (term: string) => {
				set({ searchTerm: term });

				if (term.trim() === "") {
					set({ filteredSections: ["app", "daemon", "backend", "monitors"] });
					return;
				}

				const config = get().config;
				if (!config) return;

				const filteredSections: ConfigSection[] = [];
				const searchLower = term.toLowerCase();

				// Search through each section
				Object.entries(config).forEach(([sectionKey, sectionData]) => {
					const section = sectionKey as ConfigSection;

					// Check if any key or value matches the search term
					const matches = Object.entries(sectionData).some(([key, value]) => {
						return (
							key.toLowerCase().includes(searchLower) ||
							String(value).toLowerCase().includes(searchLower)
						);
					});

					if (matches) {
						filteredSections.push(section);
					}
				});

				set({ filteredSections });
			},

			clearSearch: () => {
				set({
					searchTerm: "",
					filteredSections: ["app", "daemon", "backend", "monitors"],
				});
			},

			// UI state management
			toggleSection: (section: ConfigSection) => {
				const expandedSections = new Set(get().expandedSections);
				if (expandedSections.has(section)) {
					expandedSections.delete(section);
				} else {
					expandedSections.add(section);
				}
				set({ expandedSections });
			},

			setShowAdvancedSettings: (show: boolean) => {
				set({ showAdvancedSettings: show });
			},

			// Event handling
			handleConfigChange: (event: ConfigChangeEvent) => {
				const { section, key, value } = event;
				const currentConfig = get().config;

				if (!currentConfig) return;

				// Update the config with the new value
				const newConfig = { ...currentConfig };
				if (section === "app") {
					newConfig.app = { ...newConfig.app, [key]: value };
				} else if (section === "daemon") {
					newConfig.daemon = { ...newConfig.daemon, [key]: value };
				} else if (section === "backend") {
					if (key.startsWith("swww.")) {
						const swwwKey = key.replace("swww.", "");
						newConfig.backend.swww = {
							...newConfig.backend.swww,
							[swwwKey]: value,
						};
					} else {
						newConfig.backend = { ...newConfig.backend, [key]: value };
					}
				} else if (section === "monitors") {
					newConfig.monitors = { ...newConfig.monitors, [key]: value };
				}

				set({
					config: newConfig,
					lastSaved: Date.now(),
				});
			},

			// Validation
			validateConfig: (config: Partial<UnifiedConfig>) => {
				const errors: Array<{
					section: ConfigSection;
					key: string;
					message: string;
				}> = [];

				// Add validation logic here based on your requirements
				// For now, just basic validation

				if (
					config.app?.images_per_page &&
					(config.app.images_per_page < 1 || config.app.images_per_page > 100)
				) {
					errors.push({
						section: "app",
						key: "images_per_page",
						message: "Images per page must be between 1 and 100",
					});
				}

				if (
					config.app?.image_history_limit &&
					(config.app.image_history_limit < 1 ||
						config.app.image_history_limit > 1000)
				) {
					errors.push({
						section: "app",
						key: "image_history_limit",
						message: "Image history limit must be between 1 and 1000",
					});
				}

				return errors;
			},

			clearErrors: () => {
				set({ errors: [] });
			},
		}),
		{
			name: "settings-store",
		},
	),
);

// Initialize event listeners for real-time config updates
if (typeof window !== "undefined" && window.API_RENDERER?.goDaemon) {
	const store = useSettingsStore.getState();

	// Listen for config change events from the daemon
	// The Go handler sends events with structure: { type: "config_changed", payload: { section, key, value, timestamp } }
	window.API_RENDERER.goDaemon.onConfigChanged((event: unknown) => {
		// Convert Go handler event format to our ConfigChangeEvent format
		if (
			typeof event === "object" &&
			event !== null &&
			"type" in event &&
			event.type === "config_changed" &&
			"payload" in event &&
			typeof event.payload === "object" &&
			event.payload !== null
		) {
			const payload = event.payload as {
				section?: string;
				key?: string;
				value?: unknown;
				timestamp?: number;
			};
			if (payload.section && payload.key !== undefined) {
				const configEvent: ConfigChangeEvent = {
					section: payload.section as ConfigSection,
					key: payload.key,
					value: payload.value,
					timestamp: payload.timestamp ?? Date.now(),
				};
				store.handleConfigChange(configEvent);
			}
		}
	});
}
