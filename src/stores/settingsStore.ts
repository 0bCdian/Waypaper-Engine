/**
 * Unified Settings Store for Waypaper Engine
 *
 * Manages all configuration settings and syncs with the daemon via HTTP API.
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type {
	UnifiedConfig,
	ConfigSection,
	ConfigChangeEvent,
} from "../../shared/types/unifiedConfig";

interface SettingsStoreState {
	config: UnifiedConfig | null;
	isLoading: boolean;
	lastSaved: number | null;
	errors: Array<{ section: ConfigSection; key: string; message: string }>;
	searchTerm: string;
	filteredSections: ConfigSection[];
	expandedSections: Set<ConfigSection>;
	showAdvancedSettings: boolean;
}

interface SettingsStoreActions {
	loadConfig: () => Promise<void>;
	saveConfigSection: (
		section: ConfigSection,
		data: Record<string, unknown>,
	) => Promise<void>;
	resetToDefaults: () => Promise<void>;
	setSearchTerm: (term: string) => void;
	clearSearch: () => void;
	toggleSection: (section: ConfigSection) => void;
	setShowAdvancedSettings: (show: boolean) => void;
	handleConfigChange: (event: ConfigChangeEvent) => void;
	clearErrors: () => void;
}

type SettingsStore = SettingsStoreState & SettingsStoreActions;

const defaultConfig: UnifiedConfig = {
	app: {
		kill_daemon_on_exit: false,
		notifications: true,
		start_minimized: false,
		minimize_instead_of_close: true,
		show_monitor_modal_on_start: false,
		images_per_page: 50,
		theme: "dark",
		sort_by: "imported_at",
		sort_order: "desc",
		image_history_limit: 100,
	},
	daemon: {
		images_dir: "~/.local/share/waypaper-engine/images",
		thumbnails_dir: "~/.cache/waypaper-engine/thumbnails",
		database_dir: "~/.local/share/waypaper-engine/db",
		socket_path: "/run/user/1000/waypaper-engine.sock",
		log_level: "info",
		log_file: "~/.local/share/waypaper-engine/daemon.log",
		log_max_size_mb: 10,
		log_max_backups: 3,
		compositor: "auto",
	},
	backend: {
		type: "swww",
	},
	monitors: {
		selected_monitors: [],
		image_set_type: "individual",
	},
};

export const useSettingsStore = create<SettingsStore>()(
	devtools(
		(set, get) => ({
			config: null,
			isLoading: false,
			lastSaved: null,
			errors: [],
			searchTerm: "",
			filteredSections: ["app", "daemon", "backend", "monitors"],
			expandedSections: new Set(["app"]),
			showAdvancedSettings: false,

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
					} else {
						set({
							config: defaultConfig,
							isLoading: false,
						});
					}
				} catch (error) {
					console.error("SettingsStore: Failed to load config:", error);
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

			saveConfigSection: async (
				section: ConfigSection,
				data: Record<string, unknown>,
			) => {
				const currentConfig = get().config;
				if (!currentConfig) return;

				// Optimistic update
				const newConfig = { ...currentConfig };
				if (section === "app") {
					newConfig.app = { ...newConfig.app, ...data } as typeof newConfig.app;
				} else if (section === "daemon") {
					newConfig.daemon = { ...newConfig.daemon, ...data } as typeof newConfig.daemon;
				} else if (section === "backend") {
					// Backend data can be { type } or SwwwConfig fields (merged into backend.swww)
					if ("type" in data) {
						newConfig.backend = { ...newConfig.backend, ...data } as typeof newConfig.backend;
					} else {
						newConfig.backend = {
							...newConfig.backend,
							swww: { ...newConfig.backend.swww, ...data } as typeof newConfig.backend.swww,
						};
					}
				} else if (section === "monitors") {
					newConfig.monitors = { ...newConfig.monitors, ...data } as typeof newConfig.monitors;
				}

				set({ config: newConfig, errors: [] });

				try {
					if (section === "backend") {
						// Backend config goes through special endpoint
						if (window.API_RENDERER?.goDaemon?.updateBackendConfig) {
							await window.API_RENDERER.goDaemon.updateBackendConfig(data as any);
						}
					} else {
						if (window.API_RENDERER?.goDaemon?.updateConfigSection) {
							await window.API_RENDERER.goDaemon.updateConfigSection(section, data);
						}
					}
					set({ lastSaved: Date.now() });
				} catch (error) {
					console.error("SettingsStore: Failed to update config:", error);
					set({
						config: currentConfig,
						errors: [
							{
								section,
								key: "save",
								message: `Failed to save ${section} config`,
							},
						],
					});
				}
			},

			resetToDefaults: async () => {
				set({ isLoading: true });
				try {
					if (window.API_RENDERER?.goDaemon?.updateConfig) {
						await window.API_RENDERER.goDaemon.updateConfig(defaultConfig);
					}
					set({ config: defaultConfig, isLoading: false });
				} catch (error) {
					console.error("SettingsStore: Failed to reset config:", error);
					set({ isLoading: false });
				}
			},

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

				Object.entries(config).forEach(([sectionKey, sectionData]) => {
					const section = sectionKey as ConfigSection;
					if (typeof sectionData === "object" && sectionData !== null) {
						const matches = Object.entries(sectionData).some(([key, value]) => {
							return (
								key.toLowerCase().includes(searchLower) ||
								String(value).toLowerCase().includes(searchLower)
							);
						});
						if (matches) {
							filteredSections.push(section);
						}
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

			handleConfigChange: (_event: ConfigChangeEvent) => {
				const { loadConfig } = get();
				loadConfig();
			},

			clearErrors: () => {
				set({ errors: [] });
			},
		}),
		{ name: "settings-store" },
	),
);

// Initialize event listener for real-time config updates
if (typeof window !== "undefined" && window.API_RENDERER?.goDaemon) {
	window.API_RENDERER.goDaemon.on("config_changed", (data: unknown) => {
		const store = useSettingsStore.getState();
		store.handleConfigChange(data as ConfigChangeEvent);
	});
}
