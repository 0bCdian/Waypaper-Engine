import { create } from 'zustand';
import {
    FilterType,
    ResizeType,
    TransitionType,
    transitionPosition
} from '../../shared/types/swww';
import {
    type swwwConfigSelectType,
    type swwwConfigInsertType
} from '../../database/schema';

const initialSwwwConfig: swwwConfigInsertType['config'] = {
    resizeType: ResizeType.crop,
    fillColor: '#000000',
    filterType: FilterType.Lanczos3,
    transitionType: TransitionType.simple,
    transitionStep: 90,
    transitionDuration: 3,
    transitionFPS: 60,
    transitionAngle: 45,
    transitionPositionType: 'alias',
    transitionPosition: transitionPosition.center,
    transitionPositionIntX: 960,
    transitionPositionIntY: 540,
    transitionPositionFloatX: 0.5,
    transitionPositionFloatY: 0.5,
    invertY: false,
    transitionBezier: '.25,.1,.25,1',
    transitionWaveX: 20,
    transitionWaveY: 20
};

interface State {
    swwwConfig: swwwConfigInsertType['config'];
}

interface Actions {
    saveConfig: (data: swwwConfigInsertType['config']) => void;
    getConfig: () => swwwConfigSelectType['config'];
}
export const swwwConfigStore = create<State & Actions>()((set, get) => ({
    swwwConfig: initialSwwwConfig,
    saveConfig: (data: swwwConfigInsertType['config']) => {
        set(state => {
            return {
                ...state,
                swwwConfig: data
            };
        });
        const { updateSwwwConfig } = window.API_RENDERER;
        const newState = get().swwwConfig;
        updateSwwwConfig(newState);
    },
    getConfig: () => {
        return get().swwwConfig;
    }
}));
