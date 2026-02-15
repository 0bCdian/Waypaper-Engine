import { useEffect, useState } from "react";
import type { UnifiedConfig } from "../../shared/types/unifiedConfig";

export const useFrontendConfig = () => {
	const [isLoaded, setIsLoaded] = useState(false);
	const [config, setConfig] = useState<UnifiedConfig | null>(null);

	useEffect(() => {
		const loadConfig = async () => {
			try {
				// Use the unified config system via goDaemon
				if (window.API_RENDERER?.goDaemon?.getConfig) {
					const loadedConfig =
						await window.API_RENDERER.goDaemon.getConfig();
					setConfig(loadedConfig);
					setIsLoaded(true);
					console.log(
						"🟢 FrontendConfig: Config loaded successfully from unified system",
					);
				} else {
					console.warn(
						"🔴 FrontendConfig: goDaemon.getConfig not available",
					);
					setIsLoaded(true);
				}
			} catch (error) {
				console.error("🔴 FrontendConfig: Failed to load config:", error);
				setIsLoaded(true); // Still set as loaded to prevent infinite loading
			}
		};

		loadConfig();
	}, []);

	return { config, isLoaded };
};
