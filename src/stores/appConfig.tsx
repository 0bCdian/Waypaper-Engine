import { create } from "zustand";
import { type appConfigType } from "../../shared/types/app";
import { initialAppConfig } from "../../shared/constants";
import type { UnifiedConfig } from "../../shared/types/unifiedConfig";

interface State {
	appConfig: appConfigType;
	isSetup: boolean;
}

interface Actions {
	saveConfig: (data: appConfigType) => Promise<void>;
	requeryAppConfig: () => Promise<void>;
}

export const useAppConfigStore = create<State & Actions>()((set) => ({
	appConfig: initialAppConfig,
	isSetup: false,
	saveConfig: async (newConfig) => {
		console.log("🔵 appConfigStore: saveConfig called with:", newConfig);

		// Use the modern unified config API
		if (
			window.API_RENDERER?.goDaemon &&
			typeof window.API_RENDERER.goDaemon.setBulkConfig === "function"
		) {
			try {
				// Convert appConfigType to UnifiedConfig format
				const unifiedConfig: Partial<UnifiedConfig> = {
					app: {
						kill_daemon_on_exit: newConfig.kill_daemon_on_exit ?? false,
						notifications: newConfig.notifications ?? true,
						start_minimized: newConfig.start_minimized ?? false,
					minimize_instead_of_close:
						newConfig.minimize_instead_of_close ?? true,
					show_monitor_modal_on_start:
							newConfig.show_monitor_modal_on_start ?? false,
					images_per_page: newConfig.images_per_page ?? 20,
					theme: newConfig.theme ?? "dark",
					sort_by: newConfig.sort_by ?? "name",
						sort_order: newConfig.sort_order ?? "asc",
						image_history_limit: newConfig.image_history_limit ?? 50,
					},
				};

				await window.API_RENDERER.goDaemon.setBulkConfig(unifiedConfig);
				console.log("🔵 appConfigStore: Config saved to daemon");
			} catch (error) {
				console.error(
					"🔴 appConfigStore: Failed to save config to daemon:",
					error,
				);
			}
		} else {
			console.warn(
				"🔴 appConfigStore: setBulkConfig method not available, saving locally only",
			);
		}

		set(() => ({ appConfig: newConfig, isSetup: true }));
		console.log("🔵 appConfigStore: isSetup set to true");
	},
	requeryAppConfig: async () => {
		// Use the modern unified config API
		if (
			window.API_RENDERER?.goDaemon &&
			typeof window.API_RENDERER.goDaemon.getConfig === "function"
		) {
			try {
				const unifiedConfig = await window.API_RENDERER.goDaemon.getConfig();
				// Convert UnifiedConfig to appConfigType
				const appConfig: appConfigType = {
					kill_daemon_on_exit: unifiedConfig.app.kill_daemon_on_exit,
					notifications: unifiedConfig.app.notifications,
					start_minimized: unifiedConfig.app.start_minimized,
					minimize_instead_of_close: unifiedConfig.app.minimize_instead_of_close,
					show_monitor_modal_on_start:
						unifiedConfig.app.show_monitor_modal_on_start,
					images_per_page: unifiedConfig.app.images_per_page,
					theme: unifiedConfig.app.theme,
					sort_by: unifiedConfig.app.sort_by,
					sort_order: unifiedConfig.app.sort_order,
					image_history_limit: unifiedConfig.app.image_history_limit,
				};
				set(() => ({ appConfig }));
				console.log("🔵 appConfigStore: Config loaded from daemon");
			} catch (error) {
				console.error(
					"🔴 appConfigStore: Failed to load config from daemon:",
					error,
				);
			}
		} else {
			console.warn("🔴 appConfigStore: getConfig method not available");
		}
	},
}));
