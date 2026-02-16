import { useCallback } from "react";
import { useSettingsStore } from "../stores/settingsStore";

export function useLoadAppConfig() {
	const configLoaded = useSettingsStore((s) => !!s.config);
	const isLoading = useSettingsStore((s) => s.isLoading);
	const loadConfig = useSettingsStore((s) => s.loadConfig);

	const loadAppConfig = useCallback(() => {
		if (configLoaded || isLoading) return;
		loadConfig();
	}, [loadConfig, configLoaded, isLoading]);

	return loadAppConfig;
}
