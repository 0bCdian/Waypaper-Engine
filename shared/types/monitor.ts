// Monitor types matching the new Go daemon HTTP API
export type { Monitor, MonitorMode } from "../../electron/daemon-go-types";

// Monitor selection for API requests (just monitor name + mode)
export interface MonitorSelection {
	id: string; // Monitor name or "*" for all
	mode: "individual" | "extend" | "clone";
}

// Legacy type alias for backward compatibility during migration
export type ActiveMonitor = MonitorSelection;

export function createMonitorSelection(
	monitorName: string,
	mode: "individual" | "extend" | "clone" = "individual",
): MonitorSelection {
	return { id: monitorName, mode };
}
