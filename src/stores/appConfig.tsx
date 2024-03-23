import { create } from 'zustand';
import { type appConfigType } from '../../shared/types/app';
import { initialAppConfig } from '../../shared/constants';
const { updateAppConfig } = window.API_RENDERER;
interface State {
    appConfig: appConfigType;
    alreadyShown: boolean;
}

interface Actions {
    saveConfig: (data: appConfigType) => void;
    setAlreadyShown: (value: boolean) => void;
}

export const useAppConfigStore = create<State & Actions>()(set => ({
    appConfig: initialAppConfig,
    alreadyShown: false,
    saveConfig: newConfig => {
        updateAppConfig(newConfig);
        set(() => ({ appConfig: newConfig }));
    },
    setAlreadyShown: value => {
        set(() => ({ alreadyShown: value }));
    }
}));
