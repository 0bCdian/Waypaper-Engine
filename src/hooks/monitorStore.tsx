import { create } from "zustand";
import { type Monitor } from "../../electron/types/types";

interface ActiveMonitor {
    monitor?: Monitor;
    duplicateAcrossMonitors: boolean;
    extendAcrossMonitors: boolean;
}

interface MonitorStore {
    activeMonitor: ActiveMonitor;
    monitorsList: Monitor[];
    setActiveMonitor: (value: ActiveMonitor) => void;
    setMonitorsList: (monitorsList: Monitor[]) => void;
    getActiveMonitor: () => ActiveMonitor;
}

const initialState = {
    activeMonitor: {
        monitor: undefined,
        duplicateAcrossMonitors: false,
        extendAcrossMonitors: false
    },
    monitorsList: []
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
    getActiveMonitor() {
        return get().activeMonitor;
    }
}));
