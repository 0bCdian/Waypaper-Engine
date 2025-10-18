// Shared type contracts between Go daemon and TypeScript clients
// This file serves as the single source of truth for data structures

// Monitor Contract - Basic monitor information
export interface MonitorContract {
	name: string;
	width: number;
	height: number;
	position: {
		x: number;
		y: number;
	};
	currentImage: string;
	make?: string;
	model?: string;
	refreshRate?: number;
	scale?: number;
	transform?: number;
	physicalWidth?: number;
	physicalHeight?: number;
}

// Monitor Selection Contract - Monitor configuration for operations
export interface MonitorSelectionContract {
	id: string;
	monitors: MonitorContract[];
	mode: "individual" | "extend" | "clone";
	metadata?: {
		createdAt?: string;
		lastUsed?: string;
		userLabel?: string;
	};
}

// Image Contract - Image information
export interface ImageContract {
	id: number;
	name: string;
	path: string;
	width: number;
	height: number;
	format: string;
	rating?: number;
	time?: number; // For playlist-specific timing
	isChecked?: boolean;
	isSelected?: boolean;
}

// Playlist Contract - Playlist structure
export interface PlaylistContract {
	id: number;
	name: string;
	type: "timer" | "never" | "timeofday" | "dayofweek";
	interval?: number;
	showAnimations: boolean;
	alwaysStartOnFirstImage: boolean;
	order?: "ordered" | "random";
	currentImageIndex: number;
	images: ImageContract[];
}

// Playlist Configuration Contract - Playlist settings
export interface PlaylistConfigurationContract {
	type: "timer" | "never" | "timeofday" | "dayofweek";
	interval?: number;
	order?: "ordered" | "random";
	showAnimations: boolean;
	alwaysStartOnFirstImage: boolean;
	currentImageIndex: number;
}

// App Configuration Contract
export interface AppConfigContract {
	kill_daemon_on_exit: boolean;
	notifications: boolean;
	start_minimized: boolean;
	minimize_instead_of_close: boolean;
	random_image_monitor: "individual" | "extend" | "clone";
	show_monitor_modal_on_start: boolean;
	images_per_page: number;
	theme: "light" | "dark" | "auto" | "system";
	sidebar_collapsed: boolean;
	sort_by: "name" | "date" | "size";
	sort_order: "asc" | "desc";
	image_history_limit: number;
}

// Daemon Configuration Contract
export interface DaemonConfigContract {
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
	compositor:
		| "auto"
		| "x11"
		| "wayland"
		| "sway"
		| "hyprland"
		| "gnome"
		| "kde";
}

// Backend Configuration Contract
export interface BackendConfigContract {
	type: "swww" | "feh" | "nitrogen" | "hyprpaper" | "wallutils" | "custom";
	swww: SwwwConfigContract;
}

// Swww Configuration Contract
export interface SwwwConfigContract {
	transition_type:
		| "simple"
		| "wipe"
		| "grow"
		| "outer"
		| "wave"
		| "fade"
		| "left"
		| "right"
		| "top"
		| "bottom"
		| "center"
		| "any"
		| "random";
	transition_step: number;
	transition_duration: number;
	transition_angle: number;
	transition_pos: "center" | "top" | "bottom" | "left" | "right";
	transition_bezier: string;
	transition_wave: string;
}

// Monitors Configuration Contract
export interface MonitorsConfigContract {
	selected_monitors: string[];
	image_set_type: "individual" | "extend" | "clone";
}

// Unified Configuration Contract
export interface UnifiedConfigContract {
	app: AppConfigContract;
	daemon: DaemonConfigContract;
	backend: BackendConfigContract;
	monitors: MonitorsConfigContract;
}

// IPC Message Contract
export interface IPCMessageContract {
	action: string;
	messageId?: number;
	playlistId?: number;
	playlistName?: string;
	playlist?: PlaylistContract;
	imageIds?: number[];
	imagePaths?: string[];
	fileNames?: string[];
	cacheDir?: string;
	thumbnailsDir?: string;
	image?: {
		id: number;
		name: string;
	};
	activeMonitor?: MonitorSelectionContract;
	monitors?: string[];
	selectedImagesLength?: number;
	monitorName?: string;
	config?: ConfigDataContract;
}

// Configuration Data Contract
export interface ConfigDataContract {
	configSection?: string;
	configKey?: string;
	configValue?: any;
	frontendConfig?: Partial<UnifiedConfigContract>;
}

// IPC Response Contract
export interface IPCResponseContract<T = any> {
	action: string;
	messageId?: number;
	data?: T;
	error?: string;
}

// Event Contract
export interface EventContract {
	type: string;
	payload: any;
	metadata: EventMetadataContract;
}

// Event Metadata Contract
export interface EventMetadataContract {
	timestamp: string;
	image?: ImageEventMetadataContract;
	playlist?: PlaylistEventMetadataContract;
	monitor?: MonitorEventMetadataContract;
	config?: ConfigEventMetadataContract;
}

// Image Event Metadata Contract
export interface ImageEventMetadataContract {
	id: number;
	name: string;
	path: string;
	thumbnailPath?: string;
	width: number;
	height: number;
	format: string;
	size: number;
}

// Playlist Event Metadata Contract
export interface PlaylistEventMetadataContract {
	id: number;
	name: string;
	type: string;
	imageIndex: number;
	totalImages: number;
	imageChangeTime?: number;
	timeToNextChange?: number;
	interval?: number;
	isActive: boolean;
	isPaused: boolean;
}

// Monitor Event Metadata Contract
export interface MonitorEventMetadataContract {
	name: string;
	width: number;
	height: number;
	position?: {
		x: number;
		y: number;
	};
	currentImage?: ImageEventMetadataContract;
	selected: boolean;
}

// Config Event Metadata Contract
export interface ConfigEventMetadataContract {
	configType: string;
	key: string;
	oldValue?: any;
	newValue?: any;
}

// Type guards for runtime validation
export function isMonitorContract(obj: any): obj is MonitorContract {
	return (
		obj &&
		typeof obj.name === "string" &&
		typeof obj.width === "number" &&
		typeof obj.height === "number" &&
		obj.position &&
		typeof obj.position.x === "number" &&
		typeof obj.position.y === "number" &&
		typeof obj.currentImage === "string"
	);
}

export function isMonitorSelectionContract(
	obj: any,
): obj is MonitorSelectionContract {
	return (
		obj &&
		typeof obj.id === "string" &&
		Array.isArray(obj.monitors) &&
		obj.monitors.every(isMonitorContract) &&
		typeof obj.mode === "string" &&
		["individual", "extend", "clone"].includes(obj.mode)
	);
}

export function isImageContract(obj: any): obj is ImageContract {
	return (
		obj &&
		typeof obj.id === "number" &&
		typeof obj.name === "string" &&
		typeof obj.path === "string" &&
		typeof obj.width === "number" &&
		typeof obj.height === "number" &&
		typeof obj.format === "string"
	);
}

export function isPlaylistContract(obj: any): obj is PlaylistContract {
	return (
		obj &&
		typeof obj.id === "number" &&
		typeof obj.name === "string" &&
		typeof obj.type === "string" &&
		["timer", "never", "timeofday", "dayofweek"].includes(obj.type) &&
		typeof obj.showAnimations === "boolean" &&
		typeof obj.alwaysStartOnFirstImage === "boolean" &&
		typeof obj.currentImageIndex === "number" &&
		Array.isArray(obj.images) &&
		obj.images.every(isImageContract)
	);
}

export function isUnifiedConfigContract(
	obj: any,
): obj is UnifiedConfigContract {
	return (
		obj?.app &&
		obj.daemon &&
		obj.backend &&
		obj.monitors &&
		typeof obj.app.theme === "string" &&
		["light", "dark", "auto", "system"].includes(obj.app.theme) &&
		typeof obj.app.images_per_page === "number" &&
		typeof obj.daemon.log_level === "string" &&
		["debug", "info", "warn", "error"].includes(obj.daemon.log_level) &&
		typeof obj.backend.type === "string" &&
		["swww", "feh", "nitrogen", "hyprpaper", "wallutils", "custom"].includes(
			obj.backend.type,
		) &&
		Array.isArray(obj.monitors.selected_monitors) &&
		typeof obj.monitors.image_set_type === "string" &&
		["individual", "extend", "clone"].includes(obj.monitors.image_set_type)
	);
}

// Utility functions for creating contracts
export class ContractFactory {
	public static createMonitorSelection(
		monitors: MonitorContract[],
		mode: "individual" | "extend" | "clone",
		userLabel?: string,
	): MonitorSelectionContract {
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

	public static createPlaylist(
		name: string,
		type: "timer" | "never" | "timeofday" | "dayofweek",
		images: ImageContract[],
		options?: Partial<PlaylistConfigurationContract>,
	): PlaylistContract {
		return {
			id: 0, // Will be set by the daemon
			name,
			type,
			interval: options?.interval,
			showAnimations: options?.showAnimations ?? true,
			alwaysStartOnFirstImage: options?.alwaysStartOnFirstImage ?? false,
			order: options?.order,
			currentImageIndex: options?.currentImageIndex ?? 0,
			images,
		};
	}

	public static createImage(
		id: number,
		name: string,
		path: string,
		width: number,
		height: number,
		format: string,
		options?: Partial<ImageContract>,
	): ImageContract {
		return {
			id,
			name,
			path,
			width,
			height,
			format,
			rating: options?.rating ?? 0,
			time: options?.time,
			isChecked: options?.isChecked ?? false,
			isSelected: options?.isSelected ?? false,
		};
	}
}
