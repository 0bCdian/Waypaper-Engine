import type {
  Image,
  ImageQueryParams,
  PaginatedResponse,
  ImageHistoryEntry,
  ExtractVideoPaletteRequest,
  ExtractVideoPaletteResult,
  UpdateImageRequest,
  Playlist,
  CreatePlaylistRequest,
  UpdatePlaylistRequest,
  ActivePlaylistInstance,
  Monitor,
  UnifiedConfig,
  BackendInfo,
  MonitorMode,
  Folder,
  VideoLoopExportRequest,
  VideoLoopExportResult,
  WallpaperCurrent,
} from "./daemon-go-types";

type WallpaperSetResult = { status: string; image_id: number; monitor: string; mode: string };

/** Every operation on the "daemon" IPC channel: request fields (besides `type`) and response. */
type DaemonOps = {
  get_capabilities: { req: {}; res: { ffmpeg_available: boolean } };

  get_images: { req: { params?: ImageQueryParams }; res: PaginatedResponse<Image> };
  get_image: { req: { id: number }; res: Image };
  ensure_browser_preview: { req: { id: number; force?: boolean }; res: Image };
  video_loop_export: {
    req: { id: number; body: VideoLoopExportRequest };
    res: VideoLoopExportResult;
  };
  extract_video_palette: {
    req: { id: number; body: ExtractVideoPaletteRequest };
    res: ExtractVideoPaletteResult;
  };
  import_images: {
    req: { paths: string[]; folder_id?: number | null };
    res: { status: string; total: number };
  };
  import_web_wallpaper: { req: { path: string; folder_id?: number | null }; res: Image };
  cancel_import: { req: { batch_id: string }; res: { status: string; batch_id: string } };
  delete_images: { req: { ids: number[] }; res: { deleted: number } };
  update_image: { req: { id: number; update: UpdateImageRequest }; res: Image };
  get_image_tags: { req: {}; res: { tags: string[] } };
  get_image_history: { req: { limit?: number; monitor?: string }; res: ImageHistoryEntry[] };
  clear_image_history: { req: {}; res: { status: string } };

  get_current_wallpapers: { req: {}; res: WallpaperCurrent };
  set_wallpaper: {
    req: { image_id: number; monitor?: string; mode?: MonitorMode; monitors?: string[] };
    res: WallpaperSetResult;
  };
  random_wallpaper: { req: { monitor?: string; mode?: MonitorMode }; res: WallpaperSetResult };

  get_playlists: { req: {}; res: Playlist[] };
  get_playlist: { req: { id: number }; res: Playlist };
  create_playlist: { req: { playlist: CreatePlaylistRequest }; res: Playlist };
  update_playlist: { req: { id: number; update: UpdatePlaylistRequest }; res: Playlist };
  delete_playlist: { req: { id: number }; res: void };
  start_playlist: { req: { id: number; monitors: string[]; extend: boolean }; res: void };
  stop_playlist: { req: { id: number }; res: void };
  pause_playlist: { req: { id: number }; res: void };
  resume_playlist: { req: { id: number }; res: void };
  next_playlist_image: { req: { id: number }; res: void };
  previous_playlist_image: { req: { id: number }; res: void };
  get_active_playlists: { req: {}; res: ActivePlaylistInstance[] };

  get_folders: { req: { parent_id?: number | null; search?: string }; res: { data: Folder[] } };
  get_folder_path: { req: { id: number }; res: { data: Folder[] } };
  create_folder: { req: { name: string; parent_id?: number | null }; res: Folder };
  update_folder: {
    req: { id: number; update: { name?: string; parent_id?: number | null } };
    res: Folder;
  };
  delete_folder: {
    req: { id: number; mode?: "keep_contents" | "delete_all" };
    res: { deleted: boolean; mode: string };
  };
  move_images_to_folder: {
    req: { image_ids: number[]; folder_id: number | null };
    res: { moved: number };
  };

  get_monitors: { req: {}; res: Monitor[] };

  get_config: { req: {}; res: UnifiedConfig };
  update_config: { req: { config: Partial<UnifiedConfig> }; res: UnifiedConfig };
  update_config_section: { req: { section: string; data: Record<string, unknown> }; res: unknown };
  get_backend_config: { req: { name: string }; res: Record<string, unknown> };
  update_backend_config: { req: { name: string; patch: Record<string, unknown> }; res: void };
  reset_all_config: { req: {}; res: UnifiedConfig };
  reset_backend_config: { req: { name: string }; res: { status: string } };

  get_backends: { req: {}; res: BackendInfo[] };
  activate_backend: { req: { name: string }; res: { status: string; backend: string } };
};

export type DaemonRequest = {
  [K in keyof DaemonOps]: { type: K } & DaemonOps[K]["req"];
}[keyof DaemonOps];

export type DaemonResponse<T extends DaemonRequest> = DaemonOps[T["type"]]["res"];
