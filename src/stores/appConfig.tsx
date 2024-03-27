import { create } from 'zustand';
import { type appConfigType } from '../../shared/types/app';
import { initialAppConfig } from '../../shared/constants';
const { updateAppConfig } = window.API_RENDERER;
interface State {
    appConfig: appConfigType;
    isSetup: boolean;
}

interface Actions {
    saveConfig: (data: appConfigType) => void;
}

export const useAppConfigStore = create<State & Actions>()(set => ({
    appConfig: initialAppConfig,
    isSetup: false,
    saveConfig: newConfig => {
        updateAppConfig(newConfig);
        set(() => ({ appConfig: newConfig, isSetup: true }));
    }
}));
