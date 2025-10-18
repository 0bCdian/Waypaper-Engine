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

export interface Monitor {
	name: string;
	width: number;
	height: number;
	currentImage: string;
	position: {
		x: number;
		y: number;
	};
}

// Improved API - more semantic and flexible
export interface MonitorSelection {
	// Primary identifier - can be a single monitor name or comma-separated list
	id: string;

	// The actual monitor objects
	monitors: Monitor[];

	// Display mode
	mode: "individual" | "extend" | "clone";

	// Optional metadata
	metadata?: {
		createdAt?: string;
		lastUsed?: string;
		userLabel?: string; // User can give it a custom name
	};
}

// Legacy interface for backward compatibility
export interface ActiveMonitor {
	name: string;
	monitors: Monitor[];
	extendAcrossMonitors: boolean;
	imageSetType?: string; // "extend", "clone", or "individual"
}

// Type guards for runtime type safety
export function isMonitorSelection(obj: any): obj is MonitorSelection {
	return (
		obj &&
		typeof obj.id === "string" &&
		Array.isArray(obj.monitors) &&
		typeof obj.mode === "string" &&
		["individual", "extend", "clone"].includes(obj.mode)
	);
}

export function isActiveMonitor(obj: any): obj is ActiveMonitor {
	return (
		obj &&
		typeof obj.name === "string" &&
		Array.isArray(obj.monitors) &&
		typeof obj.extendAcrossMonitors === "boolean"
	);
}
