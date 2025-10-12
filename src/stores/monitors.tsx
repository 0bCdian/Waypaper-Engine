import { create } from "zustand";
import { type Monitor, type ActiveMonitor } from "../../shared/types/monitor";
import { type DaemonMonitorInfo } from "../../shared/types/daemonEvents";

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
        
        // Persist the configuration to unified config system
        try {
            const selectedMonitors = value.monitors.map(monitor => monitor.name);
            const imageSetType = value.extendAcrossMonitors ? 'extend' : 'individual';
            
            if (window.API_RENDERER?.goDaemon?.setAppConfig) {
                await window.API_RENDERER.goDaemon.setAppConfig('selectedMonitors', selectedMonitors);
                await window.API_RENDERER.goDaemon.setAppConfig('imageSetType', imageSetType);
                console.log("🟢 MonitorStore: Saved monitor config to unified config system");
            }
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
            
            // Check if goDaemon is available
            if (!window.API_RENDERER?.goDaemon) {
                console.error("🔴 MonitorStore: goDaemon not available");
                return;
            }

            // Check if getMonitors method exists
            if (typeof window.API_RENDERER.goDaemon.getMonitors !== 'function') {
                console.error("🔴 MonitorStore: getMonitors method not available");
                return;
            }

            console.log("🟡 MonitorStore: Calling goDaemon.getMonitors()");
            const monitors = await window.API_RENDERER.goDaemon.getMonitors();
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
            // Check if goDaemon is available
            if (!window.API_RENDERER?.goDaemon) {
                console.error("🔴 MonitorStore: goDaemon not available");
                return;
            }

            // Check if getMonitors method exists
            if (typeof window.API_RENDERER.goDaemon.getMonitors !== 'function') {
                console.error("🔴 MonitorStore: getMonitors method not available");
                return;
            }

            // Load monitors from daemon
            const monitorsList = await window.API_RENDERER.goDaemon.getMonitors();
            
            // Load config from unified system
            let selectedMonitors: string[] = [];
            let imageSetType: string = 'individual';
            
            if (window.API_RENDERER?.goDaemon?.getAppConfig) {
                const config = await window.API_RENDERER.goDaemon.getAppConfig();
                if (config && typeof config === 'object') {
                    selectedMonitors = (config as any).selectedMonitors || [];
                    imageSetType = (config as any).imageSetType || 'individual';
                }
            }
            
            if (selectedMonitors.length > 0) {
                // Find the selected monitors in the current monitor list
                const selectedMonitorObjects = monitorsList.filter((monitor: Monitor) => 
                    selectedMonitors.includes(monitor.name)
                );
                
                if (selectedMonitorObjects.length > 0) {
                    // Create active monitor configuration
                    const activeMonitor: ActiveMonitor = {
                        name: selectedMonitorObjects.map((m: DaemonMonitorInfo) => m.name).join(','),
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
                    console.log("🟢 MonitorStore: Loaded monitor config from unified config system");
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
