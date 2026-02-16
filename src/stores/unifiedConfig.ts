import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type {
	UnifiedConfig,
	ConfigChangeEvent,
	ConfigSection,
	ConfigValidationError,
	ConfigFormState,
} from "../../shared/types/unifiedConfig";

interface UnifiedConfigStore extends ConfigFormState {
	config: UnifiedConfig | null;

	// Actions
	loadConfig: () => Promise<void>;
	setConfigValue: (
		section: ConfigSection,
		data: Record<string, unknown>,
	) => Promise<void>;
	resetToDefaults: () => Promise<void>;

	// Event handling
	handleConfigChange: (event: ConfigChangeEvent) => void;

	// Validation
	validateConfig: (config: Partial<UnifiedConfig>) => ConfigValidationError[];
	clearErrors: () => void;
}

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

export const useUnifiedConfigStore = create<UnifiedConfigStore>()(
	devtools(
		(set, get) => ({
			config: null,
			isLoading: false,
			isDirty: false,
			errors: [],
			lastSaved: null,

			loadConfig: async () => {
				set({ isLoading: true, errors: [] });

				try {
					if (window.API_RENDERER?.goDaemon?.getConfig) {
						const config = await window.API_RENDERER.goDaemon.getConfig();
						set({
							config,
							isLoading: false,
							isDirty: false,
							lastSaved: Date.now(),
						});
					} else {
						set({ config: defaultConfig, isLoading: false });
					}
				} catch (error) {
					console.error("UnifiedConfig: Failed to load config:", error);
					set({
						config: defaultConfig,
						isLoading: false,
						errors: [
							{ section: "app", key: "load", message: "Failed to load configuration" },
						],
					});
				}
			},

			setConfigValue: async (
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

				set({ config: newConfig, isDirty: true });

				try {
					if (section === "backend") {
						if (window.API_RENDERER?.goDaemon?.updateBackendConfig) {
							await window.API_RENDERER.goDaemon.updateBackendConfig(data as any);
						}
					} else {
						if (window.API_RENDERER?.goDaemon?.updateConfigSection) {
							await window.API_RENDERER.goDaemon.updateConfigSection(section, data);
						}
					}
					set({ isDirty: false, lastSaved: Date.now(), errors: [] });
				} catch (error) {
					console.error("UnifiedConfig: Failed to update config:", error);
					set({
						config: currentConfig,
						errors: [{ section, key: "save", message: `Failed to update ${section}` }],
					});
				}
			},

			resetToDefaults: async () => {
				set({ isLoading: true });
				try {
					if (window.API_RENDERER?.goDaemon?.updateConfig) {
						await window.API_RENDERER.goDaemon.updateConfig(defaultConfig);
					}
					set({
						config: defaultConfig,
						isLoading: false,
						isDirty: false,
						lastSaved: Date.now(),
						errors: [],
					});
				} catch (error) {
					console.error("UnifiedConfig: Failed to reset to defaults:", error);
					set({
						isLoading: false,
						errors: [
							{ section: "app", key: "reset", message: "Failed to reset configuration" },
						],
					});
				}
			},

			handleConfigChange: (_event: ConfigChangeEvent) => {
				// Re-fetch entire config when daemon notifies of changes
				get().loadConfig();
			},

			validateConfig: (_config: Partial<UnifiedConfig>): ConfigValidationError[] => {
				return [];
			},

			clearErrors: () => {
				set({ errors: [] });
			},
		}),
		{ name: "unified-config-store" },
	),
);
