import { useSettingsStore } from "../stores/settingsStore";

export function useLoadAppConfig() {
	const configLoaded = useSettingsStore((s) => !!s.config);
	const isLoading = useSettingsStore((s) => s.isLoading);
	const loadConfig = useSettingsStore((s) => s.loadConfig);

	const loadAppConfig = () => {
		if (configLoaded || isLoading) return;
		loadConfig();
	};

	return loadAppConfig;
}
