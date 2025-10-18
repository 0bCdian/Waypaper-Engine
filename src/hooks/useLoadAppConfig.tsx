import { useCallback } from "react";
import { useUnifiedConfigStore } from "../stores/unifiedConfig";

export function useLoadAppConfig() {
	const { loadConfig, config, isLoading } = useUnifiedConfigStore();

	const loadAppConfig = useCallback(() => {
		// Only load if config is not already loaded and not currently loading
		if (config || isLoading) return;

		console.log("🔵 useLoadAppConfig: Loading unified config...");
		loadConfig();
	}, [loadConfig, config, isLoading]);

	return loadAppConfig;
}
