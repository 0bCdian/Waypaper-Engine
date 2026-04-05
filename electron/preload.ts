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
  MonitorState,
  EventType,
  Folder,
} from "./daemon-go-types";
import { unwrapIPCResponse } from "./ipcEnvelope";

function invokeWrapped<T>(channel: string, ...args: unknown[]): Promise<T> {
  return ipcRenderer.invoke(channel, ...args).then((response: unknown) => {
    return unwrapIPCResponse<T>(channel, response);
  });
}

const electronAPI = {
  goDaemon: {
    // HEALTH & SYSTEM
    ping: (): Promise<boolean> => ipcRenderer.invoke("go-daemon-command", "ping"),

    getInfo: (): Promise<DaemonInfo> => ipcRenderer.invoke("go-daemon-command", "get_info"),

    shutdown: (): Promise<void> => ipcRenderer.invoke("go-daemon-command", "shutdown"),

    // IMAGES
    getImages: (params?: ImageQueryParams): Promise<PaginatedResponse<Image>> =>
      ipcRenderer.invoke("go-daemon-command", "get_images", params),

    getImage: (id: number): Promise<Image> =>
      ipcRenderer.invoke("go-daemon-command", "get_image", { id }),
    ensureBrowserPreview: (id: number, force?: boolean): Promise<Image> =>
      ipcRenderer.invoke("go-daemon-command", "ensure_browser_preview", { id, force }),

    getImageCount: (): Promise<{ count: number }> =>
      ipcRenderer.invoke("go-daemon-command", "get_image_count"),

    importImages: (
      paths: string[],
      folderID?: number | null,
    ): Promise<{ status: string; total: number }> =>
      ipcRenderer.invoke("go-daemon-command", "import_images", {
        paths,
        folder_id: folderID,
      }),

    importWebWallpaper: (path: string, folderID?: number | null): Promise<Image> =>
      ipcRenderer.invoke("go-daemon-command", "import_web_wallpaper", {
        path,
        folder_id: folderID,
      }),

    cancelImport: (batchID: string): Promise<{ status: string; batch_id: string }> =>
      ipcRenderer.invoke("go-daemon-command", "cancel_import", {
        batch_id: batchID,
      }),

    deleteImages: (ids: number[]): Promise<{ deleted: number }> =>
      ipcRenderer.invoke("go-daemon-command", "delete_images", { ids }),

    updateImage: (id: number, update: UpdateImageRequest): Promise<Image> =>
      ipcRenderer.invoke("go-daemon-command", "update_image", { id, update }),

    renameImage: (id: number, name: string): Promise<Image> =>
      ipcRenderer.invoke("go-daemon-command", "rename_image", { id, name }),

    selectAllImages: (selected: boolean): Promise<{ updated: number; selected: boolean }> =>
      ipcRenderer.invoke("go-daemon-command", "select_all_images", {
        selected,
      }),

    getImageTags: (): Promise<{ tags: string[] }> =>
      ipcRenderer.invoke("go-daemon-command", "get_image_tags"),

    getImageHistory: (limit?: number, monitor?: string): Promise<ImageHistoryEntry[]> =>
      ipcRenderer.invoke("go-daemon-command", "get_image_history", {
        limit,
        monitor,
      }),

    clearImageHistory: (): Promise<{ status: string }> =>
      ipcRenderer.invoke("go-daemon-command", "clear_image_history"),

    // WALLPAPER
    getCurrentWallpapers: (): Promise<MonitorState[]> =>
      ipcRenderer.invoke("go-daemon-command", "get_current_wallpapers"),

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
      ipcRenderer.invoke("go-daemon-command", "set_wallpaper", {
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
      ipcRenderer.invoke("go-daemon-command", "random_wallpaper", {
        monitor: monitor || "*",
        mode: mode || "individual",
      }),

    // PLAYLISTS
    getPlaylists: (): Promise<Playlist[]> =>
      ipcRenderer.invoke("go-daemon-command", "get_playlists"),

    getPlaylist: (id: number): Promise<Playlist> =>
      ipcRenderer.invoke("go-daemon-command", "get_playlist", { id }),

    createPlaylist: (playlist: CreatePlaylistRequest): Promise<Playlist> =>
      ipcRenderer.invoke("go-daemon-command", "create_playlist", playlist),

    updatePlaylist: (id: number, update: UpdatePlaylistRequest): Promise<Playlist> =>
      ipcRenderer.invoke("go-daemon-command", "update_playlist", {
        id,
        update,
      }),

    deletePlaylist: (id: number): Promise<void> =>
      ipcRenderer.invoke("go-daemon-command", "delete_playlist", { id }),

    startPlaylist: (id: number, monitor?: string, mode?: MonitorMode): Promise<void> =>
      ipcRenderer.invoke("go-daemon-command", "start_playlist", {
        id,
        monitor: monitor || "*",
        mode: mode || "individual",
      }),

    stopPlaylist: (id: number): Promise<void> =>
      ipcRenderer.invoke("go-daemon-command", "stop_playlist", { id }),

    pausePlaylist: (id: number): Promise<void> =>
      ipcRenderer.invoke("go-daemon-command", "pause_playlist", { id }),

    resumePlaylist: (id: number): Promise<void> =>
      ipcRenderer.invoke("go-daemon-command", "resume_playlist", { id }),

    nextPlaylistImage: (id: number): Promise<void> =>
      ipcRenderer.invoke("go-daemon-command", "next_playlist_image", { id }),

    previousPlaylistImage: (id: number): Promise<void> =>
      ipcRenderer.invoke("go-daemon-command", "previous_playlist_image", {
        id,
      }),

    getActivePlaylists: (): Promise<ActivePlaylistInstance[]> =>
      ipcRenderer.invoke("go-daemon-command", "get_active_playlists"),

    getActivePlaylistForMonitor: (monitor: string): Promise<ActivePlaylistInstance> =>
      ipcRenderer.invoke("go-daemon-command", "get_active_playlist_for_monitor", { monitor }),

    stopAllPlaylists: (): Promise<void> =>
      ipcRenderer.invoke("go-daemon-command", "stop_all_playlists"),

    // FOLDERS
    getFolders: (parentId?: number | null, search?: string): Promise<{ data: Folder[] }> =>
      ipcRenderer.invoke("go-daemon-command", "get_folders", {
        parent_id: parentId,
        search,
      }),

    getFolder: (id: number): Promise<Folder> =>
      ipcRenderer.invoke("go-daemon-command", "get_folder", { id }),

    getFolderPath: (id: number): Promise<{ data: Folder[] }> =>
      ipcRenderer.invoke("go-daemon-command", "get_folder_path", { id }),

    createFolder: (name: string, parentId?: number | null): Promise<Folder> =>
      ipcRenderer.invoke("go-daemon-command", "create_folder", {
        name,
        parent_id: parentId,
      }),

    updateFolder: (
      id: number,
      update: { name?: string; parent_id?: number | null },
    ): Promise<Folder> =>
      ipcRenderer.invoke("go-daemon-command", "update_folder", {
        id,
        update,
      }),

    deleteFolder: (
      id: number,
      mode?: "keep_contents" | "delete_all",
    ): Promise<{ deleted: boolean; mode: string }> =>
      ipcRenderer.invoke("go-daemon-command", "delete_folder", {
        id,
        mode: mode || "keep_contents",
      }),

    moveImagesToFolder: (imageIds: number[], folderId: number | null): Promise<{ moved: number }> =>
      ipcRenderer.invoke("go-daemon-command", "move_images_to_folder", {
        image_ids: imageIds,
        folder_id: folderId,
      }),

    // MONITORS
    getMonitors: (): Promise<Monitor[]> => ipcRenderer.invoke("go-daemon-command", "get_monitors"),

    getMonitor: (name: string): Promise<Monitor> =>
      ipcRenderer.invoke("go-daemon-command", "get_monitor", { name }),

    // CONFIG
    getConfig: (): Promise<UnifiedConfig> => ipcRenderer.invoke("go-daemon-command", "get_config"),

    updateConfig: (config: Partial<UnifiedConfig>): Promise<UnifiedConfig> =>
      ipcRenderer.invoke("go-daemon-command", "update_config", config),

    getConfigSection: (section: string): Promise<unknown> =>
      ipcRenderer.invoke("go-daemon-command", "get_config_section", {
        section,
      }),

    updateConfigSection: (section: string, data: Record<string, unknown>): Promise<unknown> =>
      ipcRenderer.invoke("go-daemon-command", "update_config_section", {
        section,
        data,
      }),

    getBackendConfig: (): Promise<Record<string, unknown>> =>
      ipcRenderer.invoke("go-daemon-command", "get_backend_config"),

    updateBackendConfig: (config: Record<string, unknown>): Promise<void> =>
      ipcRenderer.invoke("go-daemon-command", "update_backend_config", config),

    // BACKENDS
    getBackends: (): Promise<BackendInfo[]> =>
      ipcRenderer.invoke("go-daemon-command", "get_backends"),

    getBackendCapabilities: (): Promise<BackendCapabilities | null> =>
      ipcRenderer.invoke("go-daemon-command", "get_backend_capabilities"),

    activateBackend: (name: string): Promise<{ status: string; backend: string }> =>
      ipcRenderer.invoke("go-daemon-command", "activate_backend", { name }),

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
    invokeWrapped<{ files: string[]; webRoots?: string[]; folderName?: string }>(
      "openFiles",
      action,
    ),

  scanDirectory: (
    dirPath: string,
  ): Promise<{ files: string[]; webRoots: string[]; folderName: string }> =>
    invokeWrapped("scan-directory", dirPath),

  handleOpenImages: (imagesObject: { files: string[]; folder_id?: number }) =>
    invokeWrapped<{ message: string }>("handleOpenImages", imagesObject),

  revealInFileManager: (path: string) => invokeWrapped<boolean>("reveal-in-file-manager", path),

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

console.log("Preload script loaded - Go Daemon HTTP REST API ready");
