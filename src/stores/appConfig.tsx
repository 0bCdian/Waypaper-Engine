import { create } from "zustand";
import { type appConfigType } from "../../shared/types/app";
import { initialAppConfig } from "../../shared/constants";

// Debug: Check what's available on the API_RENDERER
console.log('🔍 appConfig: window.API_RENDERER:', window.API_RENDERER);
console.log('🔍 appConfig: goDaemon:', window.API_RENDERER?.goDaemon);
console.log('🔍 appConfig: goDaemon methods:', window.API_RENDERER?.goDaemon ? Object.getOwnPropertyNames(window.API_RENDERER.goDaemon) : 'no goDaemon');

// Test basic IPC communication
if (window.API_RENDERER?.goDaemon?.testConnection) {
    console.log('🔍 appConfig: Testing IPC connection...');
    window.API_RENDERER.goDaemon.testConnection()
        .then(result => console.log('🔍 appConfig: IPC test result:', result))
        .catch(error => console.error('🔍 appConfig: IPC test error:', error));
} else {
    console.log('🔍 appConfig: testConnection method not available');
}

// const { goDaemon } = window.API_RENDERER; // Unused for now
interface State {
    appConfig: appConfigType;
    isSetup: boolean;
}

interface Actions {
    saveConfig: (data: appConfigType) => void;
    requeryAppConfig: () => Promise<void>;
}

export const useAppConfigStore = create<State & Actions>()(set => ({
    appConfig: initialAppConfig,
    isSetup: false,
    saveConfig: newConfig => {
        console.log("🔵 appConfigStore: saveConfig called with:", newConfig);
        
        // Check if goDaemon and setAppConfig method are available
        if (window.API_RENDERER?.goDaemon && typeof window.API_RENDERER.goDaemon.setAppConfig === 'function') {
            try {
                // Save each config field individually to the unified config system
                Object.entries(newConfig).forEach(([key, value]) => {
                    window.API_RENDERER.goDaemon.setAppConfig(key, value);
                });
                console.log("🔵 appConfigStore: Config saved to daemon");
            } catch (error) {
                console.error("🔴 appConfigStore: Failed to save config to daemon:", error);
            }
        } else {
            console.warn("🔴 appConfigStore: setAppConfig method not available, saving locally only");
        }
        
        set(() => ({ appConfig: newConfig, isSetup: true }));
        console.log("🔵 appConfigStore: isSetup set to true");
    },
    requeryAppConfig: async () => {
        // Check if goDaemon and getAppConfig method are available
        if (window.API_RENDERER?.goDaemon && typeof window.API_RENDERER.goDaemon.getAppConfig === 'function') {
            try {
                const newConfig = await window.API_RENDERER.goDaemon.getAppConfig();
                set(() => ({ appConfig: newConfig }));
                console.log("🔵 appConfigStore: Config loaded from daemon");
            } catch (error) {
                console.error("🔴 appConfigStore: Failed to load config from daemon:", error);
            }
        } else {
            console.warn("🔴 appConfigStore: getAppConfig method not available");
        }
    }
}));
