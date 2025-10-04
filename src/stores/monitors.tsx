import { create } from "zustand";
import { type Monitor, type ActiveMonitor } from "../../shared/types/monitor";
import { verifyOldMonitorConfigValidity } from "../utils/utilities";
import { frontendConfig } from "../utils/frontendConfig";
const { goDaemon } = window.API_RENDERER;

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
    async setActiveMonitor(value) {
        set(state => {
            return {
                ...state,
                activeMonitor: value
            };
        });
        
        // Persist the configuration to frontend config
        try {
            const selectedMonitors = value.monitors.map(monitor => monitor.name);
            const imageSetType = value.extendAcrossMonitors ? 'extend' : 'individual';
            
            await frontendConfig.setSelectedMonitors(selectedMonitors);
            await frontendConfig.setImageSetType(imageSetType);
            
            console.log("🟢 MonitorStore: Saved monitor config to frontend config");
        } catch (error) {
            console.error("🔴 MonitorStore: Failed to save monitor config:", error);
        }
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
        try {
            console.log("🟡 MonitorStore: reQueryMonitors called");
            console.log("🟡 MonitorStore: Calling goDaemon.getMonitors()");
            const monitors = await goDaemon.getMonitors();
            console.log("🟡 MonitorStore: Monitors loaded from daemon:", monitors);
            const activeMonitor = get().activeMonitor;
            
            // Create store monitors with proper selection state
            const storeMonitors = monitors.map((monitor: Monitor) => {
                const match = activeMonitor.monitors.find((activeMonitorMonitor: Monitor) => {
                    return activeMonitorMonitor.name === monitor.name;
                });
                const isSelected = match !== undefined;
                return {
                    ...monitor,
                    isSelected
                };
            });
            
            console.log("🟡 MonitorStore: Processed store monitors:", storeMonitors);
            set(state => {
                console.log("🟡 MonitorStore: Updating state with monitorsList");
                return {
                    ...state,
                    monitorsList: storeMonitors
                };
            });
            console.log("🟡 MonitorStore: reQueryMonitors completed successfully");
        } catch (error) {
            console.error("🟡 MonitorStore: Error loading monitors:", error);
        }
    },
    async setLastSavedMonitorConfig() {
        try {
            // Load monitors from daemon
            const monitorsList = await goDaemon.getMonitors();
            
            // Load frontend config
            const selectedMonitors = await frontendConfig.getSelectedMonitors();
            const imageSetType = await frontendConfig.getImageSetType();
            
            if (selectedMonitors.length > 0) {
                // Find the selected monitors in the current monitor list
                const selectedMonitorObjects = monitorsList.filter((monitor: Monitor) => 
                    selectedMonitors.includes(monitor.name)
                );
                
                if (selectedMonitorObjects.length > 0) {
                    // Create active monitor configuration
                    const activeMonitor: ActiveMonitor = {
                        name: selectedMonitorObjects.map(m => m.name).join(','),
                        monitors: selectedMonitorObjects,
                        extendAcrossMonitors: imageSetType === 'extend'
                    };
                    
                    // Set the active monitor configuration (without triggering persistence)
                    set(state => ({
                        ...state,
                        activeMonitor
                    }));
                    
                    // Create store monitors with proper selection state
                    const storeMonitors = monitorsList.map((monitor: Monitor) => {
                        const isSelected = selectedMonitors.includes(monitor.name);
                        return {
                            ...monitor,
                            isSelected
                        };
                    });
                    
                    get().setMonitorsList(storeMonitors);
                    console.log("🟢 MonitorStore: Loaded monitor config from frontend config");
                } else {
                    // Selected monitors no longer exist, reset to default
                    const storeMonitors = monitorsList.map((monitor: Monitor) => ({
                        ...monitor,
                        isSelected: false
                    }));
                    get().setMonitorsList(storeMonitors);
                    console.log("🟡 MonitorStore: Selected monitors no longer exist, reset to default");
                }
            } else {
                // No saved config, set default state
                const storeMonitors = monitorsList.map((monitor: Monitor) => ({
                    ...monitor,
                    isSelected: false
                }));
                get().setMonitorsList(storeMonitors);
                console.log("🟡 MonitorStore: No saved config, using default state");
            }
        } catch (error) {
            console.error("🟡 MonitorStore: Error setting last saved monitor config:", error);
        }
    }
}));
