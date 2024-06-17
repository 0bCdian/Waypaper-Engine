import { create } from "zustand";
import { type Monitor, type ActiveMonitor } from "../../shared/types/monitor";
import { verifyOldMonitorConfigValidity } from "../utils/utilities";
const { getMonitors, querySelectedMonitor } = window.API_RENDERER;

export interface StoreMonitor extends Monitor {
    isSelected: boolean;
}

interface MonitorStore {
    activeMonitor: ActiveMonitor;
    monitorsList: StoreMonitor[];
    setActiveMonitor: (value: ActiveMonitor) => void;
    setMonitorsList: (monitorsList: StoreMonitor[]) => void;
    reQueryMonitors: () => Promise<void>;
    setLastSavedMonitorConfig: () => Promise<void>;
}

const initialState = {
    activeMonitor: {
        name: "",
        monitors: [] as Monitor[],
        extendAcrossMonitors: false
    },
    monitorsList: [] as StoreMonitor[]
};

export const useMonitorStore = create<MonitorStore>()((set, get) => ({
    activeMonitor: initialState.activeMonitor,
    monitorsList: initialState.monitorsList,
    setActiveMonitor(value) {
        set(state => {
            return {
                ...state,
                activeMonitor: value
            };
        });
    },
    setMonitorsList(monitorsList) {
        set(state => {
            return {
                ...state,
                monitorsList
            };
        });
    },
    async reQueryMonitors() {
        const monitors = await getMonitors();
        const activeMonitor = get().activeMonitor;
        const storeMonitors = monitors.map(monitor => {
            const match = activeMonitor.monitors.find(activeMonitor => {
                return activeMonitor.name === monitor.name;
            });
            const isSelected = match !== undefined;
            return {
                ...monitor,
                isSelected
            };
        });
        set(state => {
            return {
                ...state,
                monitorsList: storeMonitors
            };
        });
    },
    async setLastSavedMonitorConfig() {
        const oldConfig = await querySelectedMonitor();
        const monitorsList = await getMonitors();
        if (
            oldConfig !== undefined &&
            verifyOldMonitorConfigValidity({
                oldConfig,
                monitorsList
            })
        ) {
            get().setActiveMonitor(oldConfig);
        }
    }
}));
