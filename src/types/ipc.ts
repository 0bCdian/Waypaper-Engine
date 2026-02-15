// Type-safe IPC communication types

// Monitor Selection API - Improved design
export interface MonitorSelection {
	id: string;
	monitors: Monitor[];
	mode: "individual" | "extend" | "clone";
	metadata?: {
		createdAt?: string;
		lastUsed?: string;
		userLabel?: string;
	};
}

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

// Configuration types with strict typing
export interface AppConfig {
	kill_daemon_on_exit: boolean;
	notifications: boolean;
	start_minimized: boolean;
	minimize_instead_of_close: boolean;
	show_monitor_modal_on_start: boolean;
	images_per_page: number;
	theme: "light" | "dark" | "auto";
	sort_by: "name" | "date" | "size";
	sort_order: "asc" | "desc";
	image_history_limit: number;
}

export interface MonitorsConfig {
	selected_monitors: string[];
	image_set_type: "individual" | "extend" | "clone";
}

export interface BackendConfig {
	type: "swww" | "feh" | "mpv";
	swww: {
		transition_type: "simple" | "fade" | "wipe" | "grow";
		transition_step: number;
		transition_duration: number;
		transition_angle: number;
		transition_pos: "center" | "top" | "bottom" | "left" | "right";
		transition_bezier: string;
		transition_wave: string;
	};
}

export interface DaemonConfig {
	database_path: string;
	images_dir: string;
	thumbnails_dir: string;
	monitors_state_file: string;
	socket_path: string;
	log_level: "debug" | "info" | "warn" | "error";
	log_file: string;
	log_max_size: number;
	log_max_age: number;
	log_max_backups: number;
	compositor: "auto" | "sway" | "hyprland" | "gnome" | "kde";
}

// Complete configuration type
export interface UnifiedConfig {
	app: AppConfig;
	monitors: MonitorsConfig;
	backend: BackendConfig;
	daemon: DaemonConfig;
}

// Partial configuration type for updates
export type PartialConfig = {
	[K in keyof UnifiedConfig]?: Partial<UnifiedConfig[K]>;
};

// Type-safe IPC response types
export interface IPCResponse<T = unknown> {
	action: string;
	data?: T;
	error?: string;
	messageId?: number;
}

export interface PartialConfigResponse {
	updated_sections: string[];
	success: boolean;
}

// Type guards for runtime validation
export function isMonitorSelection(obj: any): obj is MonitorSelection {
	return (
		obj &&
		typeof obj.id === "string" &&
		Array.isArray(obj.monitors) &&
		typeof obj.mode === "string" &&
		["individual", "extend", "clone"].includes(obj.mode)
	);
}

export function isAppConfig(obj: any): obj is AppConfig {
	return (
		obj &&
		typeof obj.theme === "string" &&
		["light", "dark", "auto"].includes(obj.theme) &&
		typeof obj.notifications === "boolean" &&
		typeof obj.images_per_page === "number" &&
		obj.images_per_page > 0
	);
}

export function isMonitorsConfig(obj: any): obj is MonitorsConfig {
	return (
		obj &&
		Array.isArray(obj.selected_monitors) &&
		obj.selected_monitors.every((name: any) => typeof name === "string") &&
		typeof obj.image_set_type === "string" &&
		["individual", "extend", "clone"].includes(obj.image_set_type)
	);
}

// Simple configuration update helper (no validation - daemon handles validation)
export class ConfigUpdater {
	public static createMonitorSelection(
		monitors: Monitor[],
		mode: "individual" | "extend" | "clone",
		userLabel?: string,
	): MonitorSelection {
		const id = monitors.map((m) => m.name).join(",");
		return {
			id,
			monitors,
			mode,
			metadata: {
				createdAt: new Date().toISOString(),
				lastUsed: new Date().toISOString(),
				userLabel,
			},
		};
	}
}
