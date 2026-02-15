export interface wlr_randr_monitor {
	name: string;
	description: string;
	make: string;
	model: string;
	serial: string;
	physical_size: {
		width: number;
		height: number;
	};
	enabled: boolean;
	modes: Array<{
		width: number;
		height: number;
		refresh: number;
		preferred: boolean;
		current: boolean;
	}>;
	position: {
		x: number;
		y: number;
	};
	transform: string;
	scale: number;
	adaptive_sync: boolean;
}

export type wlr_output = wlr_randr_monitor[];

export type MonitorMode = "individual" | "extend" | "clone";

export interface Monitor {
	name: string;
	width: number;
	height: number;
	x?: number;
	y?: number;
	scale?: number;
	refreshRate?: number;
	currentImage?: string; // Optional for backward compatibility
	position?: {
		x: number;
		y: number;
	};
}

// New API - matches Go daemon v2.0.0
export interface MonitorSelection {
	// Monitor name or "*" for all monitors
	id: string;
	// The actual monitor objects
	monitors: Monitor[];
	// Display mode
	mode: MonitorMode;
}

// Legacy interface for backward compatibility
export interface ActiveMonitor {
	name?: string;
	monitors: Monitor[];
	extendAcrossMonitors?: boolean;
	imageSetType?: string;
	// Add new fields for transition
	id?: string;
	mode?: MonitorMode;
}

// Type guards for runtime type safety
export function isMonitorSelection(obj: unknown): obj is MonitorSelection {
	return (
		typeof obj === "object" &&
		obj !== null &&
		"id" in obj &&
		typeof (obj as MonitorSelection).id === "string" &&
		"monitors" in obj &&
		Array.isArray((obj as MonitorSelection).monitors) &&
		"mode" in obj &&
		typeof (obj as MonitorSelection).mode === "string" &&
		["individual", "extend", "clone"].includes((obj as MonitorSelection).mode)
	);
}

export function isActiveMonitor(obj: unknown): obj is ActiveMonitor {
	return (
		typeof obj === "object" &&
		obj !== null &&
		"monitors" in obj &&
		Array.isArray((obj as ActiveMonitor).monitors)
	);
}

/**
 * Convert ActiveMonitor (legacy) to MonitorSelection (new API)
 */
export function convertToMonitorSelection(
	activeMonitor: ActiveMonitor,
): MonitorSelection {
	// If it already has the new structure, return it
	if (activeMonitor.id && activeMonitor.mode) {
		return {
			id: activeMonitor.id,
			monitors: activeMonitor.monitors,
			mode: activeMonitor.mode,
		};
	}

	// Convert from legacy structure
	let mode: MonitorMode = "individual";
	if (activeMonitor.extendAcrossMonitors) {
		mode = activeMonitor.imageSetType === "clone" ? "clone" : "extend";
	}

	return {
		id:
			activeMonitor.name ||
			activeMonitor.monitors.map((m) => m.name).join("_"),
		monitors: activeMonitor.monitors,
		mode,
	};
}

/**
 * Convert MonitorSelection (new API) to ActiveMonitor (legacy)
 */
export function convertToActiveMonitor(
	selection: MonitorSelection,
): ActiveMonitor {
	return {
		name: selection.id,
		monitors: selection.monitors,
		extendAcrossMonitors: selection.mode !== "individual",
		imageSetType: selection.mode,
		id: selection.id,
		mode: selection.mode,
	};
}
