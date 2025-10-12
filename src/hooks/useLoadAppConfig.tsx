import { useCallback } from "react";
import { useAppConfigStore } from "../stores/appConfig";

export function useLoadAppConfig() {
    const { saveConfig, isSetup } = useAppConfigStore();
    const loadAppConfig = useCallback(() => {
        if (isSetup) return;
        
        // Check if goDaemon is available
        if (!window.API_RENDERER?.goDaemon) {
            console.error("🔴 useLoadAppConfig: goDaemon not available");
            // Set default config if goDaemon is not available
            const defaultConfig = {
                killDaemon: false,
                notifications: true,
                startMinimized: false,
                minimizeInsteadOfClose: true,
                randomImageMonitor: "individual" as const,
                showMonitorModalOnStart: false,
                imagesPerPage: 20
            };
            console.log("🔵 useLoadAppConfig: Using default config (no daemon):", defaultConfig);
            saveConfig(defaultConfig);
            return;
        }

        // Check if getAppConfig method exists
        if (typeof window.API_RENDERER.goDaemon.getAppConfig !== 'function') {
            console.error("🔴 useLoadAppConfig: getAppConfig method not available");
            // Set default config if method doesn't exist
            const defaultConfig = {
                killDaemon: false,
                notifications: true,
                startMinimized: false,
                minimizeInsteadOfClose: true,
                randomImageMonitor: "individual" as const,
                showMonitorModalOnStart: false,
                imagesPerPage: 20
            };
            console.log("🔵 useLoadAppConfig: Using default config (no method):", defaultConfig);
            saveConfig(defaultConfig);
            return;
        }

        window.API_RENDERER.goDaemon.getAppConfig()
            .then(config => {
                console.log("🔵 useLoadAppConfig: Received config:", config);
                saveConfig(config);
            })
            .catch(error => {
                console.error("🔴 useLoadAppConfig: Failed to load config:", error);
                // Set a default config if loading fails
                const defaultConfig = {
                    killDaemon: false,
                    notifications: true,
                    startMinimized: false,
                    minimizeInsteadOfClose: true,
                    randomImageMonitor: "individual" as const,
                    showMonitorModalOnStart: false,
                    imagesPerPage: 20
                };
                console.log("🔵 useLoadAppConfig: Using default config (error):", defaultConfig);
                saveConfig(defaultConfig);
            });
    }, [isSetup, saveConfig]);
    return loadAppConfig;
}
