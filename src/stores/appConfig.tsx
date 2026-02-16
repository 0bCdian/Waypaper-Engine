import { create } from "zustand";
import { type appConfigType } from "../../shared/types/app";
import { initialAppConfig } from "../../shared/constants";

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
		if (window.API_RENDERER?.goDaemon?.updateConfig) {
			try {
				await window.API_RENDERER.goDaemon.updateConfig({
					app: {
						kill_daemon_on_exit: newConfig.kill_daemon_on_exit,
						notifications: newConfig.notifications,
						start_minimized: newConfig.start_minimized,
						minimize_instead_of_close: newConfig.minimize_instead_of_close,
						show_monitor_modal_on_start: newConfig.show_monitor_modal_on_start,
						images_per_page: newConfig.images_per_page,
						theme: newConfig.theme,
						sort_by: newConfig.sort_by,
						sort_order: newConfig.sort_order,
						image_history_limit: newConfig.image_history_limit,
					},
				});
			} catch (error) {
				console.error("appConfigStore: Failed to save config:", error);
			}
		}

		set(() => ({ appConfig: newConfig, isSetup: true }));
	},

	requeryAppConfig: async () => {
		if (window.API_RENDERER?.goDaemon?.getConfig) {
			try {
				const config = await window.API_RENDERER.goDaemon.getConfig();
				const appConfig: appConfigType = {
					kill_daemon_on_exit: config.app.kill_daemon_on_exit,
					notifications: config.app.notifications,
					start_minimized: config.app.start_minimized,
					minimize_instead_of_close: config.app.minimize_instead_of_close,
					show_monitor_modal_on_start: config.app.show_monitor_modal_on_start,
					images_per_page: config.app.images_per_page,
					theme: config.app.theme,
					sort_by: config.app.sort_by,
					sort_order: config.app.sort_order,
					image_history_limit: config.app.image_history_limit,
				};
				set(() => ({ appConfig, isSetup: true }));
			} catch (error) {
				console.error("appConfigStore: Failed to load config:", error);
			}
		}
	},
}));
