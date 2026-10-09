import { contextBridge, ipcRenderer, webUtils } from "electron";
import type {
  CreatePlaylistRequest,
  EventType,
  ExtractVideoPaletteRequest,
  ImageQueryParams,
  MonitorMode,
  UnifiedConfig,
  UpdateImageRequest,
  UpdatePlaylistRequest,
  VideoLoopExportRequest,
} from "./daemon-go-types";
import type { MultipassPayload } from "../src/shaderStudio/buildWallpaperPackage";
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
    getCapabilities: () => invoke({ type: "get_capabilities" }),

    getImages: (params?: ImageQueryParams) => invoke({ type: "get_images", params }),
    getImage: (id: number) => invoke({ type: "get_image", id }),
    ensureBrowserPreview: (id: number, force?: boolean) =>
      invoke({ type: "ensure_browser_preview", id, force }),
    videoLoopExport: (id: number, body: VideoLoopExportRequest) =>
      invoke({ type: "video_loop_export", id, body }),
    extractVideoPalette: (id: number, body: ExtractVideoPaletteRequest) =>
      invoke({ type: "extract_video_palette", id, body }),
    importImages: (paths: string[], folderID?: number | null) =>
      invoke({ type: "import_images", paths, folder_id: folderID }),
    importWebWallpaper: (path: string, folderID?: number | null) =>
      invoke({ type: "import_web_wallpaper", path, folder_id: folderID }),
    cancelImport: (batchID: string) => invoke({ type: "cancel_import", batch_id: batchID }),
    deleteImages: (ids: number[]) => invoke({ type: "delete_images", ids }),
    updateImage: (id: number, update: UpdateImageRequest) =>
      invoke({ type: "update_image", id, update }),
    getImageTags: () => invoke({ type: "get_image_tags" }),
    getImageHistory: (limit?: number, monitor?: string) =>
      invoke({ type: "get_image_history", limit, monitor }),
    clearImageHistory: () => invoke({ type: "clear_image_history" }),

    getCurrentWallpapers: () => invoke({ type: "get_current_wallpapers" }),
    setWallpaper: (imageId: number, monitor?: string, mode?: MonitorMode, monitors?: string[]) =>
      invoke({
        type: "set_wallpaper",
        image_id: imageId,
        monitor: monitor || "*",
        mode: mode || "individual",
        monitors,
      }),
    setRandomWallpaper: (monitor?: string, mode?: MonitorMode) =>
      invoke({ type: "random_wallpaper", monitor: monitor || "*", mode: mode || "individual" }),

    getPlaylists: () => invoke({ type: "get_playlists" }),
    getPlaylist: (id: number) => invoke({ type: "get_playlist", id }),
    createPlaylist: (playlist: CreatePlaylistRequest) =>
      invoke({ type: "create_playlist", playlist }),
    updatePlaylist: (id: number, update: UpdatePlaylistRequest) =>
      invoke({ type: "update_playlist", id, update }),
    deletePlaylist: (id: number) => invoke({ type: "delete_playlist", id }),
    startPlaylist: (id: number, monitors: string[], extend: boolean) =>
      invoke({ type: "start_playlist", id, monitors, extend }),
    stopPlaylist: (id: number) => invoke({ type: "stop_playlist", id }),
    pausePlaylist: (id: number) => invoke({ type: "pause_playlist", id }),
    resumePlaylist: (id: number) => invoke({ type: "resume_playlist", id }),
    nextPlaylistImage: (id: number) => invoke({ type: "next_playlist_image", id }),
    previousPlaylistImage: (id: number) => invoke({ type: "previous_playlist_image", id }),
    getActivePlaylists: () => invoke({ type: "get_active_playlists" }),

    getFolders: (parentId?: number | null, search?: string) =>
      invoke({ type: "get_folders", parent_id: parentId, search }),
    getFolderPath: (id: number) => invoke({ type: "get_folder_path", id }),
    createFolder: (name: string, parentId?: number | null) =>
      invoke({ type: "create_folder", name, parent_id: parentId }),
    updateFolder: (id: number, update: { name?: string; parent_id?: number | null }) =>
      invoke({ type: "update_folder", id, update }),
    deleteFolder: (id: number, mode?: "keep_contents" | "delete_all") =>
      invoke({ type: "delete_folder", id, mode: mode || "keep_contents" }),
    moveImagesToFolder: (imageIds: number[], folderId: number | null) =>
      invoke({ type: "move_images_to_folder", image_ids: imageIds, folder_id: folderId }),

    getMonitors: () => invoke({ type: "get_monitors" }),

    getConfig: () => invoke({ type: "get_config" }),
    updateConfig: (config: Partial<UnifiedConfig>) => invoke({ type: "update_config", config }),
    updateConfigSection: (section: string, data: Record<string, unknown>) =>
      invoke({ type: "update_config_section", section, data }),
    getBackendConfig: (name: string) => invoke({ type: "get_backend_config", name }),
    updateBackendConfig: (name: string, patch: Record<string, unknown>) =>
      invoke({ type: "update_backend_config", name, patch }),
    resetAllConfig: () => invoke({ type: "reset_all_config" }),
    resetBackendConfig: (name: string) => invoke({ type: "reset_backend_config", name }),

    getBackends: () => invoke({ type: "get_backends" }),
    activateBackend: (name: string) => invoke({ type: "activate_backend", name }),

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

  exitApp: () => invokeWrapped<void>("exit-app"),

  getDaemonStatus: () =>
    invokeWrapped<{ isRunning: boolean; lastChecked: number; lastError?: string }>(
      "get-daemon-status",
    ),
  restartDaemon: () => invokeWrapped<{ success: true }>("restart-daemon"),
  startDaemon: () => invokeWrapped<{ success: true }>("start-daemon"),
  stopDaemon: () => invokeWrapped<{ success: true }>("stop-daemon"),

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
          multipass: MultipassPayload;
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

export type ElectronAPI = typeof electronAPI;

contextBridge.exposeInMainWorld("API_RENDERER", electronAPI);
