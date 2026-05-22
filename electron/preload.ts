/**
 * Preload Script for Waypaper Engine
 *
 * Exposes safe APIs to the renderer process via contextBridge.
 * Updated for Go Daemon HTTP REST API
 */

import { contextBridge, ipcRenderer, webUtils } from "electron";
import type {
  Image,
  ImageQueryParams,
  PaginatedResponse,
  ImageHistoryEntry,
  UpdateImageRequest,
  Playlist,
  CreatePlaylistRequest,
  UpdatePlaylistRequest,
  ActivePlaylistInstance,
  Monitor,
  UnifiedConfig,
  BackendInfo,
  BackendCapabilities,
  DaemonInfo,
  MonitorMode,
  WallpaperCurrent,
  EventType,
  Folder,
  ExtractVideoPaletteRequest,
  ExtractVideoPaletteResult,
  VideoLoopExportRequest,
  VideoLoopExportResult,
} from "./daemon-go-types";
import type { DaemonRequest, DaemonResponse } from "./ipc-types";
import { unwrapIPCResponse } from "./ipcEnvelope";

function invoke<T extends DaemonRequest>(req: T): Promise<DaemonResponse<T>> {
  return ipcRenderer.invoke("daemon", req) as Promise<DaemonResponse<T>>;
}

function invokeWrapped<T>(channel: string, ...args: unknown[]): Promise<T> {
  return ipcRenderer.invoke(channel, ...args).then((response: unknown) => {
    return unwrapIPCResponse<T>(channel, response);
  });
}

const electronAPI = {
  goDaemon: {
    // HEALTH & SYSTEM
    ping: (): Promise<boolean> => invoke({ type: "ping" }),

    getInfo: (): Promise<DaemonInfo> => invoke({ type: "get_info" }),

    getCapabilities: (): Promise<{ ffmpeg_available: boolean }> =>
      invoke({ type: "get_capabilities" }),

    shutdown: (): Promise<void> => invoke({ type: "shutdown" }),

    // IMAGES
    getImages: (params?: ImageQueryParams): Promise<PaginatedResponse<Image>> =>
      invoke({ type: "get_images", params }),

    getImage: (id: number): Promise<Image> => invoke({ type: "get_image", id }),

    ensureBrowserPreview: (id: number, force?: boolean): Promise<Image> =>
      invoke({ type: "ensure_browser_preview", id, force }),

    videoLoopExport: (id: number, body: VideoLoopExportRequest): Promise<VideoLoopExportResult> =>
      invoke({ type: "video_loop_export", id, body }),

    extractVideoPalette: (
      id: number,
      body: ExtractVideoPaletteRequest,
    ): Promise<ExtractVideoPaletteResult> => invoke({ type: "extract_video_palette", id, body }),

    importImages: (
      paths: string[],
      folderID?: number | null,
    ): Promise<{ status: string; total: number }> =>
      invoke({ type: "import_images", paths, folder_id: folderID }),

    importWebWallpaper: (path: string, folderID?: number | null): Promise<Image> =>
      invoke({ type: "import_web_wallpaper", path, folder_id: folderID }),

    cancelImport: (batchID: string): Promise<{ status: string; batch_id: string }> =>
      invoke({ type: "cancel_import", batch_id: batchID }),

    deleteImages: (ids: number[]): Promise<{ deleted: number }> =>
      invoke({ type: "delete_images", ids }),

    updateImage: (id: number, update: UpdateImageRequest): Promise<Image> =>
      invoke({ type: "update_image", id, update }),

    selectAllImages: (selected: boolean): Promise<{ updated: number; selected: boolean }> =>
      invoke({ type: "select_all_images", selected }),

    getImageTags: (): Promise<{ tags: string[] }> => invoke({ type: "get_image_tags" }),

    getImageHistory: (limit?: number, monitor?: string): Promise<ImageHistoryEntry[]> =>
      invoke({ type: "get_image_history", limit, monitor }),

    clearImageHistory: (): Promise<{ status: string }> => invoke({ type: "clear_image_history" }),

    // WALLPAPER
    getCurrentWallpapers: (): Promise<WallpaperCurrent> =>
      invoke({ type: "get_current_wallpapers" }),

    setWallpaper: (
      imageId: number,
      monitor?: string,
      mode?: MonitorMode,
      monitors?: string[],
    ): Promise<{
      status: string;
      image_id: number;
      monitor: string;
      mode: string;
    }> =>
      invoke({
        type: "set_wallpaper",
        image_id: imageId,
        monitor: monitor || "*",
        mode: mode || "individual",
        monitors,
      }),

    setRandomWallpaper: (
      monitor?: string,
      mode?: MonitorMode,
    ): Promise<{
      status: string;
      image_id: number;
      monitor: string;
      mode: string;
    }> =>
      invoke({
        type: "random_wallpaper",
        monitor: monitor || "*",
        mode: mode || "individual",
      }),

    // PLAYLISTS
    getPlaylists: (): Promise<Playlist[]> => invoke({ type: "get_playlists" }),

    getPlaylist: (id: number): Promise<Playlist> => invoke({ type: "get_playlist", id }),

    createPlaylist: (playlist: CreatePlaylistRequest): Promise<Playlist> =>
      invoke({ type: "create_playlist", playlist }),

    updatePlaylist: (id: number, update: UpdatePlaylistRequest): Promise<Playlist> =>
      invoke({ type: "update_playlist", id, update }),

    deletePlaylist: (id: number): Promise<void> => invoke({ type: "delete_playlist", id }),

    startPlaylist: (id: number, monitor?: string, mode?: MonitorMode): Promise<void> =>
      invoke({
        type: "start_playlist",
        id,
        monitor: monitor || "*",
        mode: mode || "individual",
      }),

    stopPlaylist: (id: number): Promise<void> => invoke({ type: "stop_playlist", id }),

    pausePlaylist: (id: number): Promise<void> => invoke({ type: "pause_playlist", id }),

    resumePlaylist: (id: number): Promise<void> => invoke({ type: "resume_playlist", id }),

    nextPlaylistImage: (id: number): Promise<void> => invoke({ type: "next_playlist_image", id }),

    previousPlaylistImage: (id: number): Promise<void> =>
      invoke({ type: "previous_playlist_image", id }),

    getActivePlaylists: (): Promise<ActivePlaylistInstance[]> =>
      invoke({ type: "get_active_playlists" }),

    getActivePlaylistForMonitor: (monitor: string): Promise<ActivePlaylistInstance> =>
      invoke({ type: "get_active_playlist_for_monitor", monitor }),

    stopAllPlaylists: (): Promise<void> => invoke({ type: "stop_all_playlists" }),

    // FOLDERS
    getFolders: (parentId?: number | null, search?: string): Promise<{ data: Folder[] }> =>
      invoke({ type: "get_folders", parent_id: parentId, search }),

    getFolder: (id: number): Promise<Folder> => invoke({ type: "get_folder", id }),

    getFolderPath: (id: number): Promise<{ data: Folder[] }> =>
      invoke({ type: "get_folder_path", id }),

    createFolder: (name: string, parentId?: number | null): Promise<Folder> =>
      invoke({ type: "create_folder", name, parent_id: parentId }),

    updateFolder: (
      id: number,
      update: { name?: string; parent_id?: number | null },
    ): Promise<Folder> => invoke({ type: "update_folder", id, update }),

    deleteFolder: (
      id: number,
      mode?: "keep_contents" | "delete_all",
    ): Promise<{ deleted: boolean; mode: string }> =>
      invoke({ type: "delete_folder", id, mode: mode || "keep_contents" }),

    moveImagesToFolder: (imageIds: number[], folderId: number | null): Promise<{ moved: number }> =>
      invoke({
        type: "move_images_to_folder",
        image_ids: imageIds,
        folder_id: folderId,
      }),

    // MONITORS
    getMonitors: (): Promise<Monitor[]> => invoke({ type: "get_monitors" }),

    getMonitor: (name: string): Promise<Monitor> => invoke({ type: "get_monitor", name }),

    // CONFIG
    getConfig: (): Promise<UnifiedConfig> => invoke({ type: "get_config" }),

    updateConfig: (config: Partial<UnifiedConfig>): Promise<UnifiedConfig> =>
      invoke({ type: "update_config", config }),

    getConfigSection: (section: string): Promise<unknown> =>
      invoke({ type: "get_config_section", section }),

    updateConfigSection: (section: string, data: Record<string, unknown>): Promise<unknown> =>
      invoke({ type: "update_config_section", section, data }),

    getBackendConfig: (name: string): Promise<Record<string, unknown>> =>
      invoke({ type: "get_backend_config", name }),

    updateBackendConfig: (name: string, patch: Record<string, unknown>): Promise<void> =>
      invoke({ type: "update_backend_config", name, patch }),

    resetAllConfig: (): Promise<UnifiedConfig> => invoke({ type: "reset_all_config" }),

    resetBackendConfig: (name: string): Promise<{ status: string }> =>
      invoke({ type: "reset_backend_config", name }),

    // BACKENDS
    getBackends: (): Promise<BackendInfo[]> => invoke({ type: "get_backends" }),

    getBackendCapabilities: (): Promise<BackendCapabilities | null> =>
      invoke({ type: "get_backend_capabilities" }),

    activateBackend: (name: string): Promise<{ status: string; backend: string }> =>
      invoke({ type: "activate_backend", name }),

    // EVENT LISTENERS (SSE events forwarded via IPC)
    // Returns a disposer function that removes the listener when called.
    // contextBridge does not preserve function identity, so the classic
    // on/off(callback) pattern cannot work. The disposer captures the
    // exact wrapper reference in the preload closure.
    on: (event: EventType, callback: (data: unknown) => void): (() => void) => {
      const channel = `go-daemon-event-${event}`;
      const wrapper = (_: Electron.IpcRendererEvent, data: unknown) => callback(data);
      ipcRenderer.on(channel, wrapper);
      return () => {
        ipcRenderer.off(channel, wrapper);
      };
    },
  },

  getNativeTheme: () => invokeWrapped<unknown>("get-native-theme"),

  setThemeSource: (source: "system" | "light" | "dark") =>
    invokeWrapped<void>("set-theme-source", source),

  onNativeThemeUpdated: (callback: (themeInfo: unknown) => void): (() => void) => {
    const wrapper = (_: Electron.IpcRendererEvent, themeInfo: unknown) => callback(themeInfo);
    ipcRenderer.on("native-theme-updated", wrapper);
    return () => ipcRenderer.removeListener("native-theme-updated", wrapper);
  },

  onThemeChanged: (callback: (data: unknown) => void): (() => void) => {
    const wrapper = (_: Electron.IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on("theme-changed", wrapper);
    return () => ipcRenderer.removeListener("theme-changed", wrapper);
  },

  getAppInfo: () => invokeWrapped<unknown>("get-app-info"),
  ping: () => invokeWrapped<unknown>("ping"),

  getWindowBounds: () => invokeWrapped<Electron.Rectangle>("get-window-bounds"),
  setWindowBounds: (bounds: Electron.Rectangle) => invokeWrapped<void>("set-window-bounds", bounds),
  minimizeWindow: () => invokeWrapped<void>("minimize-window"),
  maximizeWindow: () => invokeWrapped<void>("maximize-window"),
  closeWindow: () => invokeWrapped<void>("close-window"),
  hideWindow: () => invokeWrapped<void>("hide-window"),
  showWindow: () => invokeWrapped<void>("show-window"),

  exitApp: () => invokeWrapped<void>("exit-app"),

  getDaemonStatus: () => invokeWrapped<unknown>("get-daemon-status"),
  restartDaemon: () => invokeWrapped<unknown>("restart-daemon"),
  startDaemon: () => invokeWrapped<unknown>("start-daemon"),
  stopDaemon: () => invokeWrapped<unknown>("stop-daemon"),

  onAppError: (callback: (error: unknown) => void): (() => void) => {
    const wrapper = (_: Electron.IpcRendererEvent, error: unknown) => callback(error);
    ipcRenderer.on("app-error", wrapper);
    return () => ipcRenderer.removeListener("app-error", wrapper);
  },

  onDaemonStatusUpdate: (callback: (data: unknown) => void): (() => void) => {
    const wrapper = (_: Electron.IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on("daemon-status-update", wrapper);
    return () => ipcRenderer.removeListener("daemon-status-update", wrapper);
  },

  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },

  wallhaven: {
    search: (params: Record<string, string>): Promise<unknown> =>
      invokeWrapped("wallhaven-search", params),

    getWallpaper: (id: string): Promise<unknown> => invokeWrapped("wallhaven-wallpaper", id),

    testApiKey: (apiKey: string): Promise<unknown> => invokeWrapped("wallhaven-test-key", apiKey),

    download: (imageUrl: string): Promise<string> => invokeWrapped("wallhaven-download", imageUrl),
  },

  getPathForFile: (file: File): string => webUtils.getPathForFile(file),

  downloadUrl: (url: string): Promise<string> => invokeWrapped("download-url", url),

  openFiles: (action: "file" | "folder" | "video" | "web") =>
    invokeWrapped<{
      files: string[];
      webRoots?: string[];
      folderName?: string;
    }>("openFiles", action),

  writeShaderWebWallpaperPackage: (
    payload:
      | {
          kind?: "single";
          shader: string;
          title: string;
          mode: "temp" | "export";
          previewPngBuffers?: Uint8Array[];
          previewFps?: number;
        }
      | {
          kind: "multipass";
          multipass: unknown;
          title: string;
          mode: "temp" | "export";
          previewPngBuffers?: Uint8Array[];
          previewFps?: number;
        },
  ): Promise<{ canceled: boolean; packageDir: string }> =>
    invokeWrapped("write-shader-web-wallpaper-package", payload),

  scanDirectory: (
    dirPath: string,
  ): Promise<{ files: string[]; webRoots: string[]; folderName: string }> =>
    invokeWrapped("scan-directory", dirPath),

  handleOpenImages: (imagesObject: { files: string[]; folder_id?: number }) =>
    invokeWrapped<{ message: string }>("handleOpenImages", imagesObject),

  revealInFileManager: (path: string) => invokeWrapped<boolean>("reveal-in-file-manager", path),

  exportWallpapersToFolder: (
    items: Array<{
      id: number;
      name: string;
      path: string;
      media_type: string;
      package_root?: string | null;
    }>,
  ): Promise<{
    canceled: boolean;
    destination: string;
    exported: number;
    failed: number;
  }> => invokeWrapped("export-wallpapers-to-folder", items),

  // YOUTUBE DOWNLOAD (background job in main; survives renderer route changes)
  checkYtDlp: (): Promise<{ available: boolean }> => invokeWrapped("check-yt-dlp"),

  startYoutubeDownload: (url: string): Promise<{ jobId: string }> =>
    invokeWrapped("youtube-download-start", { url }),

  cancelYoutubeDownload: (jobId: string): Promise<{ canceled: boolean }> =>
    invokeWrapped("youtube-download-cancel", { jobId }),

  onYoutubeDownloadEvent: (callback: (event: unknown) => void): (() => void) => {
    const wrapper = (_: Electron.IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on("youtube-download-event", wrapper);
    return () => ipcRenderer.removeListener("youtube-download-event", wrapper);
  },

  // LOGGING
  logToMain: (
    level: "debug" | "info" | "warn" | "error",
    message: string,
    data?: Record<string, unknown>,
  ): void => {
    ipcRenderer.send("log-to-main", { level, message, data });
  },
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld("API_RENDERER", electronAPI);

// Expose debug mode flag
const isDebug = process.argv.includes("--debug");
contextBridge.exposeInMainWorld("__DEBUG__", isDebug);

// Expose platform so the renderer can render platform-appropriate window chrome
contextBridge.exposeInMainWorld("__PLATFORM__", process.platform);

console.log("Preload script loaded - Go Daemon HTTP REST API ready");
