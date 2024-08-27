import { useCallback } from "react";
import { useAppConfigStore } from "../stores/appConfig";
const { readAppConfig } = window.API_RENDERER;

export function useLoadAppConfig() {
    const { saveConfig, isSetup } = useAppConfigStore();
    const loadAppConfig = useCallback(() => {
        if (isSetup) return;
        void readAppConfig().then(config => {
            saveConfig(config);
        });
    }, [isSetup]);
    return loadAppConfig;
}
