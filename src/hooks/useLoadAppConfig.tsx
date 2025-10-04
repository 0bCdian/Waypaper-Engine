import { useCallback } from "react";
import { useAppConfigStore } from "../stores/appConfig";
const { goDaemon } = window.API_RENDERER;

export function useLoadAppConfig() {
    const { saveConfig, isSetup } = useAppConfigStore();
    const loadAppConfig = useCallback(() => {
        if (isSetup) return;
        goDaemon.getAppConfig()
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
                console.log("🔵 useLoadAppConfig: Using default config:", defaultConfig);
                saveConfig(defaultConfig);
            });
    }, [isSetup, saveConfig]);
    return loadAppConfig;
}
