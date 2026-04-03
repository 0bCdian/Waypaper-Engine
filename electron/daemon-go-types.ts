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
  media_type?: "image" | "video" | "gif" | "web";
  search?: string;
  tags?: string;
  colors?: string;
  folder_id?: number | "root";
}

// ============================================================================
// IMAGE TYPES
// ============================================================================

export interface Image {
  id: number;
  name: string;
  path: string;
  media_type: string;
  duration: number;
  audio_enabled: boolean;
  width: number;
  height: number;
  format: string;
  file_size: number;
  checksum: string;
  tags: string[];
  colors: string[];
  imported_at: string;
  source_path: string;
  is_selected: boolean;
  thumbnails: ImageThumbnails;
  preview_path?: string;
  web_meta?: WebMeta | null;
  folder_id: number | null;
}

export interface WebCapabilities {
  network: boolean;
  keyboard: boolean;
  audio_reactive: boolean;
  parallax_aware: boolean;
}

export interface WebMeta {
  package_root: string;
  manifest_path: string;
  entry_path: string;
  title: string;
  description: string;
  author: string;
  capabilities: WebCapabilities;
  properties?: Record<string, unknown>;
}

export interface ImageThumbnails {
  default: string;
  "720p": string;
  "1080p": string;
  "1440p": string;
  "4k": string;
}

// ============================================================================
// FOLDER TYPES
// ============================================================================

export interface Folder {
  id: number;
  name: string;
  parent_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateFolderRequest {
  name: string;
  parent_id?: number | null;
}

export interface UpdateFolderRequest {
  name?: string;
  parent_id?: number | null;
}

export interface MoveImagesRequest {
  image_ids: number[];
  folder_id: number | null;
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

export type ImageHistorySourceType = "manual" | "random" | "playlist" | "history" | "restore";

export interface ImageHistorySource {
  type: ImageHistorySourceType;
  playlist_id?: number;
  playlist_name?: string;
  history_id?: number;
}

// ============================================================================
// MONITOR TYPES
// ============================================================================

export interface MonitorState {
  monitor_name: string;
  image_id: number;
  image_name: string;
  image_path: string;
  mode: string;
  backend: string;
  set_at: string;
}

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
  media_type?: string;
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

// ActivePlaylistInstance represents a running playlist and the monitors it owns.
// Used by both getActivePlaylists and getActivePlaylistForMonitor.
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
  monitors: string[];
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
  /** Canonical transition length in seconds (float). When set, awww and wayland-utauri use this value. */
  transition_duration_seconds?: number;
  awww?: AwwwConfig;
  feh?: FehConfig;
  hyprpaper?: HyprpaperConfig;
  waylandutauri?: WaylandUtauriConfig;
}

export interface AwwwConfig {
  transition_type: string;
  transition_step: number;
  /** Seconds for awww `--transition-duration` (fractional allowed). Legacy whole numbers 500–5000 are treated as ms. */
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

export interface FehConfig {
  mode: string;
}

export interface HyprpaperConfig {
  fit_mode: string;
  config_path: string;
}

export interface WaylandUtauriConfig {
  socket_path: string;
  expected_service: string;
  expected_api_version: string;
  connect_timeout_ms: number;
  request_timeout_ms: number;
  transition: string;
  duration_ms: number;
  /** CSS cubic-bezier(x1,y1,x2,y2) control points, comma-separated */
  transition_bezier?: string;
  /** Degrees 0–359; used for generic `wipe` and wave angle (directional presets lock angle). */
  transition_angle_deg?: number;
  transition_origin_x_percent?: number;
  transition_origin_y_percent?: number;
  transition_wave_amplitude_percent?: number;
  transition_wave_frequency?: number;
  parallax_enabled?: boolean;
  parallax_zoom?: number;
  parallax_step_percent?: number;
  parallax_animation_ms?: number;
  parallax_easing?: [number, number, number, number];
  video_audio_default?: boolean;
}

export interface MonitorsConfig {
  selected_monitors: string[];
  image_set_type: MonitorMode;
}

export interface WallhavenConfig {
  api_key: string;
  enabled: boolean;
  scroll_mode: "paginated" | "infinite";
}

export interface UnifiedConfig {
  app: AppConfig;
  daemon: DaemonConfig;
  backend: BackendSection;
  monitors: MonitorsConfig;
  wallhaven: WallhavenConfig;
}

// ============================================================================
// BACKEND TYPES
// ============================================================================

export interface BackendCapabilities {
  compositors: string[];
  media_types: string[];
  transitions: boolean;
  per_monitor: boolean;
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
  /** Present on daemons built with monitor stack v2+ (see handler/health.go). */
  monitor_stack_version?: number;
  monitor_provider_order?: string[];
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
  | "processing_cancelled"
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
  // History Events
  | "history_cleared"
  // Gallery Events
  | "images_updated"
  | "playlists_updated"
  | "folders_updated"
  // Connection Events (Electron-only, not from daemon SSE)
  | "sse_disconnected"
  | "sse_reconnected";

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

export interface ProcessingCancelledPayload {
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
  monitors?: string[];
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
  colors?: string[];
  is_selected?: boolean;
}

export interface ImportImagesRequest {
  paths: string[];
  folder_id?: number | null;
}

export interface ImportWebWallpaperRequest {
  path: string;
  folder_id?: number | null;
}

export interface DeleteImagesRequest {
  ids: number[];
}

export interface SelectAllImagesRequest {
  selected: boolean;
}
