import { create } from "zustand";
import {
	FilterType,
	ResizeType,
	TransitionType,
	transitionPosition,
} from "../../shared/types/swww";

// Define config types locally since database schema is no longer used
interface SwwwConfig {
	resizeType: ResizeType;
	fillColor: string;
	filterType: FilterType;
	transitionType: TransitionType;
	transitionStep: number;
	transitionDuration: number;
	transitionFPS: number;
	transitionAngle: number;
	transitionPositionType: string;
	transitionPosition: transitionPosition;
	transitionPositionIntX: number;
	transitionPositionIntY: number;
	transitionPositionFloatX: number;
	transitionPositionFloatY: number;
	invertY: boolean;
	transitionBezier: string;
	transitionWaveX: number;
	transitionWaveY: number;
}

const initialSwwwConfig: SwwwConfig = {
	resizeType: ResizeType.crop,
	fillColor: "#000000",
	filterType: FilterType.Lanczos3,
	transitionType: TransitionType.simple,
	transitionStep: 90,
	transitionDuration: 3,
	transitionFPS: 60,
	transitionAngle: 45,
	transitionPositionType: "alias",
	transitionPosition: transitionPosition.center,
	transitionPositionIntX: 960,
	transitionPositionIntY: 540,
	transitionPositionFloatX: 0.5,
	transitionPositionFloatY: 0.5,
	invertY: false,
	transitionBezier: ".25,.1,.25,1",
	transitionWaveX: 20,
	transitionWaveY: 20,
};

interface State {
	swwwConfig: SwwwConfig;
}

interface Actions {
	saveConfig: (data: SwwwConfig) => void;
	getConfig: () => SwwwConfig;
}
export const swwwConfigStore = create<State & Actions>()((set, get) => ({
	swwwConfig: initialSwwwConfig,
	saveConfig: (data: SwwwConfig) => {
		set((state) => {
			return {
				...state,
				swwwConfig: data,
			};
		});
		const { goDaemon } = window.API_RENDERER;
		const newState = get().swwwConfig;
		goDaemon.setSwwwConfig({ config: JSON.stringify(newState) });
	},
	getConfig: () => {
		return get().swwwConfig;
	},
}));
