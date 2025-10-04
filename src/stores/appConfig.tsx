import { create } from "zustand";
import { type appConfigType } from "../../shared/types/app";
import { initialAppConfig } from "../../shared/constants";
const { goDaemon } = window.API_RENDERER;
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
        // Update config via Go daemon
        goDaemon.setAppConfig("config", newConfig);
        set(() => ({ appConfig: newConfig, isSetup: true }));
        console.log("🔵 appConfigStore: isSetup set to true");
    },
    requeryAppConfig: async () => {
        const newConfig = await goDaemon.getAppConfig();
        set(() => ({ appConfig: newConfig }));
    }
}));
