// Go Daemon IPC API Type Definitions
// Based on GO_DAEMON_IPC_API.md v2.0.0

// ============================================================================
// MESSAGE & RESPONSE STRUCTURES
// ============================================================================

export interface DaemonMessage {
	action: string;
	messageId?: number;
	playlistId?: number;
	playlistName?: string;
	playlist?: RendererPlaylist;
	imageIds?: number[];
	imagePaths?: string[];
	fileNames?: string[];
	image?: ImageInfo;
	activeMonitor?: MonitorSelection;
	monitors?: string[];
	monitorName?: string;
	config?: ConfigData;
	eventTypes?: string[];
}

export interface DaemonResponse<T = unknown> {
	action: string;
	messageId?: number;
	data?: T;
	error?: string;
}

export interface DaemonEvent<T = unknown> {
	type: EventType;
	payload: T;
}

// ============================================================================
// EVENT TYPES
// ============================================================================

export type EventType =
	// Image Processing Events
	| "processing_started"
	| "image_processed"
	| "image_progress"
	| "image_error"
	| "processing_complete"
	// Playlist Events
	| "playlist_started"
	| "playlist_stopped"
	| "playlist_paused"
	| "playlist_resumed"
	| "playlist_image_changed"
	// Wallpaper Events
	| "wallpaper_changed"
	| "image_changed"
	// Monitor Events
	| "monitor_changed"
	| "monitor_disconnected"
	// Configuration Events
	| "config_changed"
	// Gallery Events
	| "images_updated"
	| "playlists_updated";

// ============================================================================
// MONITOR TYPES
// ============================================================================

export type MonitorMode = "individual" | "clone" | "extend";

export interface Monitor {
	name: string;
	width: number;
	height: number;
	x?: number;
	y?: number;
	scale?: number;
	refreshRate?: number;
}

export interface MonitorSelection {
	id: string; // Monitor name or "*" for all monitors
	monitors: Monitor[];
	mode: MonitorMode;
}

// ============================================================================
// PLAYLIST TYPES
// ============================================================================

export type PlaylistType =
	| "timer"
	| "never"
	| "manual"
	| "time_of_day"
	| "day_of_week"
	| "timeofday" // Legacy format
	| "dayofweek"; // Legacy format

export type PlaylistOrder = "ordered" | "random";

export interface RendererImage {
	id: number;
	time?: number; // Minutes since midnight (0-1439) for time_of_day playlists
}

export interface PlaylistConfiguration {
	type: PlaylistType;
	interval?: number; // Seconds for timer playlists
	order?: PlaylistOrder;
	showAnimations: boolean;
	alwaysStartOnFirstImage: boolean;
	currentImageIndex: number;
}

export interface RendererPlaylist {
	name: string;
	images: RendererImage[];
	configuration: PlaylistConfiguration;
	activeMonitor?: MonitorSelection;
}

export interface PlaylistMetadata {
	version: string;
	createdAt: string;
	lastModified: string;
}

export interface PlaylistImage {
	imageId: string;
	imagePath: string;
	mediaType: string;
	index: number;
	addedAt: string;
	time?: number; // For time_of_day playlists
}

export interface StoredPlaylist {
	id: string;
	name: string;
	metadata: PlaylistMetadata;
	configuration: {
		type: string;
		interval?: number;
		showAnimations: boolean;
		alwaysStartOnFirstImage: boolean;
		order: string;
	};
	images: PlaylistImage[];
}

export interface RunningPlaylistInfo {
	playlist_id: number;
	playlist_name: string;
	active_monitor: MonitorSelection;
	paused: boolean;
}

export interface PlaylistDiagnostics {
	monitor: string;
	playlistId: number;
	playlistName: string;
	currentIndex: number;
	paused: boolean;
	totalImages: number;
	status: string;
}

// ============================================================================
// IMAGE TYPES
// ============================================================================

export interface ImageInfo {
	id: number;
	name: string;
}

export interface ImageHistory {
	imageId: string;
	timestamp: string;
	monitorName: string;
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

export interface ConfigData {
	// For single key updates (legacy)
	configSection?: string;
	configKey?: string;
	configValue?: unknown;

	// For partial bulk updates (modern)
	frontendConfig?: {
		app?: Partial<AppConfig>;
		daemon?: Partial<DaemonConfig>;
		backend?: Partial<BackendConfig>;
		monitors?: Partial<MonitorsConfig>;
	};
}

export interface AppConfig {
	kill_daemon_on_exit: boolean;
	notifications: boolean;
	start_minimized: boolean;
	minimize_instead_of_close: boolean;
	show_monitor_modal_on_start: boolean;
	images_per_page: number;
	theme: "light" | "dark" | "system";
	sort_by: "name" | "date" | "size";
	sort_order: "asc" | "desc";
	image_history_limit: number;
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
	compositor: "auto" | "x11" | "wayland";
}

export interface SwwwConfig {
	transition_type:
		| "simple"
		| "wipe"
		| "grow"
		| "outer"
		| "wave"
		| "none"
		| "fade";
	transition_step: number;
	transition_duration: number;
	transition_angle: number;
	transition_pos: "center" | "top" | "bottom" | "left" | "right";
	transition_bezier: string;
	transition_wave: string;
}

export interface BackendConfig {
	type: "swww" | "hyprpaper" | "swaybg" | "feh" | "nitrogen" | "custom";
	swww: SwwwConfig;
}

export interface MonitorsConfig {
	selected_monitors: string[];
	image_set_type: "individual" | "extend" | "clone";
}

export interface UnifiedConfig {
	app: AppConfig;
	daemon: DaemonConfig;
	backend: BackendConfig;
	monitors: MonitorsConfig;
}

// ============================================================================
// SYSTEM TYPES
// ============================================================================

export interface DaemonInfo {
	status: string;
	version: string;
}

export interface DaemonStatus {
	running: boolean;
	uptime: string;
	version: string;
	monitors: number;
	playlists: number;
	images: number;
}

// ============================================================================
// EVENT PAYLOAD TYPES
// ============================================================================

export interface PlaylistStartedPayload {
	playlistID: number;
	monitorName: string;
}

export interface PlaylistStoppedPayload {
	monitorName: string;
	playlistID: number;
}

export interface PlaylistImageChangedPayload {
	monitorName: string;
	playlistID: number;
	imageIndex: number;
	imageID: string;
}

export interface ImageProcessedPayload {
	originalFileName: string;
	uniqueFileName: string;
	width: number;
	height: number;
	format: string;
}

export interface ImagesUpdatedPayload {
	totalAdded?: number;
	totalDeleted?: number;
}

export interface PlaylistsUpdatedPayload {
	action: "saved" | "deleted";
	playlistId: string;
	playlistName: string;
}

export interface ConfigChangedPayload {
	section: string;
	key: string;
	value: unknown;
	timestamp: number;
}
