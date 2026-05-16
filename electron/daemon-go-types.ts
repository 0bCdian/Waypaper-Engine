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
  /** Comma-separated `#hex~maxDeltaE` (CIE76 vs stored palette). */
  colors_near?: string;
  /** Gallery images whose palette is within ΔE of this image's palette (CIE76 min pairwise). */
  palette_similar_to?: number;
  /** Inclusive max ΔE vs reference palette; omit to use daemon default (18). */
  palette_max_delta_e?: number;
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
  /** User overrides for keys declared in web_meta.wallpaper_config */
  wallpaper_config_overrides?: Record<string, unknown>;
  folder_id: number | null;
}

export interface WebCapabilities {
  network: boolean;
  keyboard: boolean;
  audio_reactive: boolean;
  parallax_aware: boolean;
  /** Wayland host: allow WebKit pointer hit-testing (fluid sim, mouse-follow, in-page controls). */
  pointer_interactive?: boolean;
}

export interface WebWallpaperConfigProp {
  type: string;
  default?: unknown;
  label?: string;
  min?: number;
  max?: number;
  step?: number;
}

export interface WebMeta {
  package_root: string;
  manifest_path: string;
  entry_path: string;
  title: string;
  description: string;
  author: string;
  capabilities: WebCapabilities;
  wallpaper_config?: Record<string, WebWallpaperConfigProp>;
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

/** One monitor row in GET /wallpaper/current (active backend only). */
export interface WallpaperCurrentSlot {
  monitor_name: string;
  image_id: number;
  image_name: string;
  image_path: string;
  set_at: string;
}

/** GET /wallpaper/current — single summary for the active wallpaper backend. */
export interface WallpaperCurrent {
  backend: string;
  image_id: number;
  image_name: string;
  image_path: string;
  mode: string;
  /** Omitted or null only from older daemons; prefer []. */
  monitors?: WallpaperCurrentSlot[] | null;
  set_at?: string;
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
  always_start_on_first_image: boolean;
}

export interface PlaylistImage {
  image_id: number;
  media_type?: string;
  time?: number;
}

export interface PlaylistPlayback {
  was_running: boolean;
  current_index: number;
  paused: boolean;
  mode: string;
  monitors: string[];
  timer_indices?: number[];
  timer_cursor?: number;
}

export interface Playlist {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  configuration: PlaylistConfiguration;
  images: PlaylistImage[];
  playback?: PlaylistPlayback;
}

// ActivePlaylistInstance represents a running playlist and the monitors it owns.
// Used by both getActivePlaylists and getActivePlaylistForMonitor.
export interface ActivePlaylistInstance {
  playlist_id: number;
  playlist_name: string;
  /** Present when connected to a current daemon; rotation strategy for the running playlist. */
  playlist_type?: PlaylistType;
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
  /** Full-window startup boot sequence (~2s) after config loads. */
  startup_intro: boolean;
  images_per_page: number;
  /** DaisyUI theme name (e.g. kolision-raw) or system for OS sync */
  theme: string;
  /** bundled | google_sans | system | custom */
  font_preset: string;
  /** CSS font-family fragment when font_preset is custom */
  font_family_body: string;
  font_family_display: string;
  font_family_mono: string;
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

export interface AutoPriorities {
  image: string[];
  video: string[];
  web: string[];
}

export interface BackendSection {
  type: string;
  /** Canonical transition length in seconds (float). When set, awww and wal-qt use this value. */
  transition_duration_seconds?: number;
  /** "fixed" (default) or "auto" — controls whether the daemon uses a single backend or picks per media type. */
  selection_mode?: "fixed" | "auto";
  /** Per-media backend priority lists, used when selection_mode == "auto". */
  auto_priorities?: AutoPriorities;
  awww?: AwwwConfig;
  feh?: FehConfig;
  hyprpaper?: HyprpaperConfig;
  mpvpaper?: MpvpaperConfig;
  swaybg?: SwaybgConfig;
  /** Merged from [backend.wal-qt] (hyphenated TOML table). */
  "wal-qt"?: WalQtConfig;
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

/** swaybg Wayland image wallpaper setter ([backend.swaybg] in TOML). */
export interface SwaybgConfig {
  /** swaybg `-m` mode: stretch | fit | fill | center | tile. */
  fit_mode: string;
}

/** mpvpaper Wayland video wallpaper backend ([backend.mpvpaper] in TOML). */
export interface MpvpaperConfig {
  mpv_options: string;
  /** 0 = none, 1 = -v, 2 = -vv */
  verbose: number;
  auto_pause: boolean;
  auto_stop: boolean;
  layer: string;
  slideshow_secs: number;
}

export interface WalQtConfig {
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
  /** Per parallax-move / sync: normalized step size in % (POST /wallpaper/parallax). */
  parallax_step_percent?: number;
  /** Hyprland/Sway: workspace ID ring size for choosing move direction (shortest path on the ring). */
  parallax_workspace_chunk_size?: number;
  parallax_animation_ms?: number;
  parallax_reset_ms?: number;
  parallax_easing?: [number, number, number, number];
  /** Hyprland/Sway workspace follow → POST /wallpaper/parallax-move: auto | off | hyprland | sway */
  parallax_compositor_driver?: string;
  /** Workspace parallax axis when waypaper.json does not set parallax_direction: horizontal | vertical */
  parallax_direction?: string;
  /** CSS object-fit for image wallpapers: fill | contain | cover | none | scale-down */
  image_fit_mode?: string;
  /** CSS image-rendering for image wallpapers: auto | smooth | high-quality | crisp-edges | pixelated */
  image_rendering?: string;
  /** Padding/background color used when the image does not fully cover the monitor. RRGGBB or RRGGBBAA hex (no '#'). Mirrors awww's --fill-color. */
  fill_color?: string;
  video_audio_default?: boolean;
  /** When true, HTML wallpapers may use fetch/XHR to the network (synced to wal-qt at runtime). */
  allow_network_wallpapers?: boolean;
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

export type ContentKind = "static_image" | "gif" | "video" | "web_wallpaper";

export interface BackendCapabilities {
  content_kinds: ContentKind[];
  compositors: string[];
}

export interface BackendInfo {
  name: string;
  available: boolean;
  active: boolean;
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
  // Gallery Events — GUI refresh signals; re-fetch the collection named in domain.
  | "gallery_changed"
  | "backend_unavailable"
  | "wallpaper_restore_failed"
  | "playlist_skipped_incompatible"
  | "playlist_no_compatible_item"
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
  /** Gallery wallpaper kind: static/animated as `image`, or `web` / `video`. */
  media_type: "image" | "web" | "video";
  /** Absolute path to the gallery file for this image. */
  path: string;
  /** Dominant colors when present (e.g. extracted for still images). */
  colors?: string[];
  /** User tags on the gallery image (empty array if none). */
  tags: string[];
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

export type GalleryDomain = "images" | "folders" | "playlists" | "history";

export interface GalleryChangedPayload {
  domain: GalleryDomain;
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
  wallpaper_config_overrides?: Record<string, unknown>;
  /** Partial merge into web_meta.capabilities; synced to waypaper.json `capabilities` by the daemon. */
  web_capabilities?: Partial<WebCapabilities>;
}

export interface ImportImagesRequest {
  paths: string[];
  folder_id?: number | null;
}

export interface ImportWebWallpaperRequest {
  path: string;
  folder_id?: number | null;
}

export interface VideoLoopExportRequest {
  in_seconds: number;
  out_seconds: number;
  preset: "webm_vp9" | "mp4_h264" | string;
  action: "replace" | "import_new" | string;
  folder_id?: number | null;
  /** Midpoint split + FFmpeg xfade (output slightly shorter than span); falls back to plain trim if unsupported. */
  blend_halves?: boolean;
}

export interface VideoLoopExportResult {
  action: string;
  image_id: number;
  path: string;
}

export interface ExtractVideoPaletteRequest {
  time_seconds: number;
}

export interface ExtractVideoPaletteResult {
  colors: string[];
  image_id: number;
  image: Image;
}

export interface DeleteImagesRequest {
  ids: number[];
}

export interface SelectAllImagesRequest {
  selected: boolean;
}
