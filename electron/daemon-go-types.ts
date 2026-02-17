// Go Daemon HTTP API Type Definitions
// Based on daemon/API_CONTRACT.md - HTTP over Unix socket REST API

// ============================================================================
// ERROR FORMAT
// ============================================================================

export interface DaemonError {
	error: string;
	code: number;
}

// ============================================================================
// PAGINATION
// ============================================================================

export interface Pagination {
	page: number;
	per_page: number;
	total_items: number;
	total_pages: number;
}

export interface PaginatedResponse<T> {
	data: T[];
	pagination: Pagination;
}

// ============================================================================
// IMAGE QUERY PARAMS
// ============================================================================

export interface ImageQueryParams {
	page?: number;
	per_page?: number;
	sort_by?: "name" | "imported_at" | "file_size";
	sort_order?: "asc" | "desc";
	media_type?: "image" | "video" | "gif";
	search?: string;
	tags?: string;
}

// ============================================================================
// IMAGE TYPES
// ============================================================================

export interface Image {
	id: number;
	name: string;
	path: string;
	media_type: string;
	width: number;
	height: number;
	format: string;
	file_size: number;
	checksum: string;
	tags: string[];
	imported_at: string;
	source_path: string;
	is_selected: boolean;
	thumbnails: ImageThumbnails;
}

export interface ImageThumbnails {
	default: string;
	"720p": string;
	"1080p": string;
	"1440p": string;
	"4k": string;
}

export interface ImageHistoryEntry {
	id: number;
	image_id: number;
	image_name: string;
	monitors: string[];
	mode: MonitorMode;
	set_at: string;
	source: ImageHistorySource;
	backend: string;
}

export type ImageHistorySourceType =
	| "manual"
	| "random"
	| "playlist"
	| "history"
	| "restore";

export interface ImageHistorySource {
	type: ImageHistorySourceType;
	playlist_id?: number;
	playlist_name?: string;
	history_id?: number;
}

// ============================================================================
// MONITOR TYPES
// ============================================================================

export type MonitorMode = "individual" | "clone" | "extend";

export interface Monitor {
	name: string;
	width: number;
	height: number;
	x: number;
	y: number;
	scale: number;
	refresh_rate: number;
	transform: number;
}

// ============================================================================
// PLAYLIST TYPES
// ============================================================================

export type PlaylistType = "timer" | "manual" | "time_of_day" | "day_of_week";
export type PlaylistOrder = "ordered" | "random";

export interface PlaylistConfiguration {
	type: PlaylistType;
	interval?: number;
	order?: PlaylistOrder;
	show_animations: boolean;
	always_start_on_first_image: boolean;
}

export interface PlaylistImage {
	image_id: number;
	time?: number;
}

export interface Playlist {
	id: number;
	name: string;
	created_at: string;
	updated_at: string;
	configuration: PlaylistConfiguration;
	images: PlaylistImage[];
}

export interface ActivePlaylistInstance {
	playlist_id: number;
	playlist_name: string;
	current_index: number;
	current_image_id: number;
	previous_image_id: number | null;
	next_image_id: number | null;
	total_images: number;
	paused: boolean;
	mode: MonitorMode;
	started_at: string;
	next_change_at: string | null;
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

export interface AppConfig {
	kill_daemon_on_exit: boolean;
	notifications: boolean;
	start_minimized: boolean;
	minimize_instead_of_close: boolean;
	show_monitor_modal_on_start: boolean;
	images_per_page: number;
	theme: "light" | "dark" | "system";
	image_history_limit: number;
	sort_by: "name" | "imported_at" | "file_size";
	sort_order: "asc" | "desc";
}

export interface DaemonConfig {
	images_dir: string;
	thumbnails_dir: string;
	database_dir: string;
	socket_path: string;
	log_level: "debug" | "info" | "warn" | "error";
	log_file: string;
	log_max_size_mb: number;
	log_max_backups: number;
	compositor: "auto" | "wayland" | "x11";
}

export interface BackendSection {
	type: string;
	swww?: SwwwConfig;
}

export interface SwwwConfig {
	transition_type: string;
	transition_step: number;
	transition_duration: number;
	transition_fps: number;
	transition_angle: number;
	transition_pos: string;
	transition_bezier: string;
	transition_wave: string;
	resize: string;
	fill_color: string;
	filter_type: string;
	invert_y: boolean;
}

export interface MonitorsConfig {
	selected_monitors: string[];
	image_set_type: MonitorMode;
}

export interface UnifiedConfig {
	app: AppConfig;
	daemon: DaemonConfig;
	backend: BackendSection;
	monitors: MonitorsConfig;
}

// ============================================================================
// BACKEND TYPES
// ============================================================================

export interface BackendCapabilities {
	compositors: string[];
	media_types: string[];
	transitions: boolean;
	per_monitor: boolean;
	native_extend: boolean;
	daemon_process: boolean;
}

export interface BackendInfo {
	name: string;
	available: boolean;
	capabilities: BackendCapabilities;
}

// ============================================================================
// SYSTEM TYPES
// ============================================================================

export interface DaemonInfo {
	version: string;
	pid: number;
	hostname: string;
	uptime: string;
	go_version: string;
	os: string;
	arch: string;
}

export interface HealthResponse {
	status: "ok";
}

export interface ShutdownResponse {
	status: "shutting_down";
}

// ============================================================================
// EVENT TYPES (SSE)
// ============================================================================

export type EventType =
	// Image Processing Events
	| "processing_started"
	| "image_processed"
	| "image_error"
	| "processing_complete"
	// Wallpaper Events
	| "wallpaper_changed"
	// Playlist Events
	| "playlist_started"
	| "playlist_stopped"
	| "playlist_paused"
	| "playlist_resumed"
	| "playlist_image_changed"
	// Monitor Events
	| "monitor_connected"
	| "monitor_disconnected"
	// Config Events
	| "config_changed"
	// Gallery Events
	| "images_updated"
	| "playlists_updated";

// ============================================================================
// EVENT PAYLOADS
// ============================================================================

export interface ProcessingStartedPayload {
	batch_id: string;
	total: number;
}

export interface ImageProcessedPayload {
	batch_id: string;
	image: Image;
	current: number;
	total: number;
	elapsed_ms: number;
}

export interface ImageErrorPayload {
	batch_id: string;
	path: string;
	error: string;
	elapsed_ms: number;
}

export interface ProcessingCompletePayload {
	batch_id: string;
	total: number;
	succeeded: number;
	failed: number;
	elapsed_ms: number;
}

export interface WallpaperChangedPayload {
	image_id: number;
	monitors: string[];
	mode: MonitorMode;
	source: ImageHistorySourceType;
	backend: string;
}

export interface PlaylistEventPayload {
	playlist_id: number;
	monitor: string;
}

export interface PlaylistImageChangedPayload {
	playlist_id: number;
	image_id: number;
	monitor: string;
}

export interface MonitorEventPayload {
	name: string;
}

export interface ConfigChangedPayload {
	sections: string[];
}

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

export interface SetWallpaperRequest {
	image_id: number;
	monitor?: string;
	mode?: MonitorMode;
}

export interface SetWallpaperResponse {
	status: "set";
	image_id: number;
	monitor: string;
	mode: MonitorMode;
}

export interface StartPlaylistRequest {
	monitor?: {
		id?: string;
		mode?: MonitorMode;
	};
}

export interface CreatePlaylistRequest {
	name: string;
	configuration: PlaylistConfiguration;
	images: PlaylistImage[];
}

export interface UpdatePlaylistRequest {
	name?: string;
	configuration?: Partial<PlaylistConfiguration>;
	images?: PlaylistImage[];
}

export interface UpdateImageRequest {
	name?: string;
	tags?: string[];
	is_selected?: boolean;
}

export interface ImportImagesRequest {
	paths: string[];
}

export interface DeleteImagesRequest {
	ids: number[];
}

export interface SelectAllImagesRequest {
	selected: boolean;
}
