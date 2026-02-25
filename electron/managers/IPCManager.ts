/**
 * IPC Manager for Electron Main Process
 *
 * Centralized IPC handler management. Routes renderer requests to the
 * Go daemon HTTP client and forwards SSE events back to renderer windows.
 */

import { ipcMain, BrowserWindow, dialog, app } from "electron";
import { resolve } from "node:path";
import { readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { goDaemonClient } from "../goDaemonClient";
import { daemonMonitor } from "./DaemonMonitor";
import { logger } from "../logger";
import type {
  Image,
  ImageQueryParams,
  UpdateImageRequest,
  MonitorMode,
  CreatePlaylistRequest,
  UpdatePlaylistRequest,
  UnifiedConfig,
  SwwwConfig,
} from "../daemon-go-types";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg"]);

async function scanDirectoryForImages(dirPath: string): Promise<string[]> {
  const imageFiles: string[] = [];
  try {
    const entries = await readdir(dirPath);
    for (const entry of entries) {
      const fullPath = join(dirPath, entry);
      try {
        const stats = await stat(fullPath);
        if (stats.isDirectory()) {
          const subImages = await scanDirectoryForImages(fullPath);
          imageFiles.push(...subImages);
        } else if (stats.isFile()) {
          const ext = entry.toLowerCase().substring(entry.lastIndexOf("."));
          if (IMAGE_EXTENSIONS.has(ext)) {
            imageFiles.push(fullPath);
          }
        }
      } catch {
        // Skip inaccessible files
      }
    }
  } catch (err) {
    logger.error({ err, dirPath }, "Error scanning directory");
  }
  return imageFiles;
}

export interface IPCHandler {
  channel: string;
  handler: (event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown> | unknown;
}

export class IPCManager {
  private handlers: Map<string, IPCHandler> = new Map();
  private windows: Set<BrowserWindow> = new Set();
  private isInitialized = false;

  initialize(): void {
    if (this.isInitialized) return;

    this.setupDefaultHandlers();
    this.setupGoDaemonHandlers();
    this.setupThemeHandlers();
    this.setupWindowHandlers();
    this.setupWallhavenHandlers();
    this.setupDownloadHandlers();
    this.setupErrorHandling();
    this.setupRendererLogging();

    this.isInitialized = true;
  }

  registerWindow(window: BrowserWindow): void {
    this.windows.add(window);
  }

  registerHandler(handler: IPCHandler): void {
    if (this.handlers.has(handler.channel)) {
      logger.warn({ channel: handler.channel }, "IPC handler already exists for channel");
      return;
    }

    if (ipcMain.listenerCount(handler.channel) > 0) {
      logger.warn(
        { channel: handler.channel },
        "IPC handler already registered in Electron for channel",
      );
      return;
    }

    this.handlers.set(handler.channel, handler);

    const unwrappedChannels = ["go-daemon-command"];

    ipcMain.handle(handler.channel, async (event, ...args) => {
      try {
        const result = await handler.handler(event, ...args);

        if (unwrappedChannels.includes(handler.channel)) {
          return result;
        }

        return { success: true, data: result };
      } catch (error) {
        logger.error({ err: error, channel: handler.channel }, "IPC error");

        if (unwrappedChannels.includes(handler.channel)) {
          throw error;
        }

        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    });
  }

  private setupDefaultHandlers(): void {
    this.registerHandler({
      channel: "ping",
      handler: async () => {
        return { message: "pong", timestamp: Date.now() };
      },
    });

    this.registerHandler({
      channel: "get-app-info",
      handler: async () => {
        return {
          name: "Waypaper Engine",
          version: "2.0.4",
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version,
          electronVersion: process.versions.electron,
        };
      },
    });

    this.registerHandler({
      channel: "get-window-bounds",
      handler: async (event) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (!window) return null;
        return window.getBounds();
      },
    });

    this.registerHandler({
      channel: "set-window-bounds",
      handler: async (event, ...args: unknown[]) => {
        const bounds = args[0] as Partial<Electron.Rectangle>;
        const window = BrowserWindow.fromWebContents(event.sender);
        if (!window) return false;
        window.setBounds(bounds);
        return true;
      },
    });

    this.registerHandler({
      channel: "exit-app",
      handler: async () => {
        return await this.handleExitApp();
      },
    });

    this.registerHandler({
      channel: "get-daemon-status",
      handler: async () => {
        return daemonMonitor.getStatus();
      },
    });

    this.registerHandler({
      channel: "restart-daemon",
      handler: async () => {
        return await daemonMonitor.restartDaemon();
      },
    });

    this.registerHandler({
      channel: "start-daemon",
      handler: async () => {
        return await daemonMonitor.startDaemon();
      },
    });

    this.registerHandler({
      channel: "stop-daemon",
      handler: async () => {
        return await daemonMonitor.stopDaemon();
      },
    });
  }

  private setupGoDaemonHandlers(): void {
    this.registerHandler({
      channel: "go-daemon-command",
      handler: async (_event, ...args: unknown[]) => {
        const action = args[0] as string;
        const payload = args[1] as unknown | undefined;
        return await this.handleGoDaemonCommand(action, payload);
      },
    });

    // File operations
    this.registerHandler({
      channel: "openFiles",
      handler: async (event, action) => {
        const mainWindow = BrowserWindow.fromWebContents(event.sender);
        if (!mainWindow) {
          throw new Error("No window available");
        }

        let result: Electron.OpenDialogReturnValue;
        if (action === "file") {
          result = await dialog.showOpenDialog(mainWindow, {
            title: "Select Images",
            filters: [
              {
                name: "Images",
                extensions: ["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"],
              },
              { name: "All Files", extensions: ["*"] },
            ],
            properties: ["openFile", "multiSelections"],
          });
        } else if (action === "folder") {
          result = await dialog.showOpenDialog(mainWindow, {
            title: "Select Folder",
            properties: ["openDirectory"],
          });
        } else {
          throw new Error("Invalid action");
        }

        if (result.canceled || !result.filePaths?.length) {
          return { files: [] };
        }

        let files: string[] = [];
        let folderName: string | undefined;

        if (action === "folder") {
          for (const folderPath of result.filePaths) {
            if (!folderName) {
              folderName = folderPath.split("/").pop() || folderPath.split("\\").pop();
            }
            const folderImages = await scanDirectoryForImages(folderPath);
            files.push(...folderImages);
          }
        } else {
          files = result.filePaths;
        }

        return { files, folderName };
      },
    });

    this.registerHandler({
      channel: "handleOpenImages",
      handler: async (_event, ...args: unknown[]) => {
        const imagesObject = args[0] as {
          success: boolean;
          data: { files: string[]; folder_id?: number };
        };
        if (
          !imagesObject.success ||
          !imagesObject.data.files ||
          imagesObject.data.files.length === 0
        ) {
          return { message: "No files to process" };
        }

        const files: string[] = imagesObject.data.files;
        const folderId = imagesObject.data.folder_id;

        await goDaemonClient.importImages(files, folderId);

        return { message: `Processing ${files.length} images...` };
      },
    });

    this.registerHandler({
      channel: "scan-directory",
      handler: async (_event, ...args: unknown[]) => {
        const dirPath = args[0] as string;
        const stats_ = await stat(dirPath);
        if (!stats_.isDirectory()) {
          throw new Error("Path is not a directory");
        }
        const files = await scanDirectoryForImages(dirPath);
        const folderName = dirPath.split("/").pop() || dirPath.split("\\").pop() || dirPath;
        return { files, folderName };
      },
    });

    // Setup SSE event forwarding
    this.setupGoDaemonEventForwarding();

    // Reveal file in file manager
    this.registerHandler({
      channel: "reveal-in-file-manager",
      handler: async (_event, ...args: unknown[]) => {
        let filePath = args[0] as string;
        if (filePath?.startsWith("atom://")) {
          filePath = `/${filePath.slice("atom://".length)}`;
        }
        const { shell } = await import("electron");
        shell.showItemInFolder(filePath);
        return true;
      },
    });
  }

  private convertPathsToAtomProtocol(images: Image[]): Image[] {
    if (!Array.isArray(images)) return images;

    return images.map((image) => {
      if (!image || typeof image !== "object") return image;

      const converted = { ...image };

      // Convert main image path
      if (converted.path && !converted.path.startsWith("atom:")) {
        if (converted.path.startsWith("/")) {
          converted.path = `atom://${converted.path.substring(1)}`;
        } else {
          const absolutePath = resolve(converted.path);
          converted.path = `atom://${absolutePath.substring(1)}`;
        }
      }

      // Convert thumbnail paths
      if (converted.thumbnails && typeof converted.thumbnails === "object") {
        const thumbs: Record<string, string> = {
          ...converted.thumbnails,
        };
        for (const key of Object.keys(thumbs)) {
          const thumbPath = thumbs[key];
          if (thumbPath && !thumbPath.startsWith("atom:")) {
            if (thumbPath.startsWith("/")) {
              thumbs[key] = `atom://${thumbPath.substring(1)}`;
            } else {
              const absolutePath = resolve(thumbPath);
              thumbs[key] = `atom://${absolutePath.substring(1)}`;
            }
          }
        }
        converted.thumbnails = thumbs as unknown as typeof converted.thumbnails;
      }

      return converted;
    });
  }

  private async handleGoDaemonCommand(action: string, payload?: unknown): Promise<unknown> {
    try {
      const p = payload as Record<string, unknown> | undefined;

      switch (action) {
        // HEALTH & SYSTEM
        case "ping":
          return await goDaemonClient.ping();
        case "get_info":
          return await goDaemonClient.getInfo();
        case "shutdown":
        case "stop_daemon":
          await goDaemonClient.shutdown();
          return { status: "shutting_down" };

        // IMAGES
        case "get_images": {
          const result = await goDaemonClient.getImages(p as ImageQueryParams | undefined);
          result.data = this.convertPathsToAtomProtocol(result.data);
          return result;
        }
        case "get_image": {
          const image = await goDaemonClient.getImage(p?.id as number);
          return this.convertPathsToAtomProtocol([image])[0];
        }
        case "get_image_count":
          return await goDaemonClient.getImageCount();
        case "import_images":
          return await goDaemonClient.importImages(
            p?.paths as string[],
            p?.folder_id as number | undefined,
          );
        case "cancel_import":
          return await goDaemonClient.cancelImport(p?.batch_id as string);
        case "delete_images":
          return await goDaemonClient.deleteImages(p?.ids as number[]);
        case "update_image":
          return await goDaemonClient.updateImage(p?.id as number, p?.update as UpdateImageRequest);
        case "rename_image": {
          const renamed = await goDaemonClient.renameImage(p?.id as number, p?.name as string);
          return this.convertPathsToAtomProtocol([renamed])[0];
        }
        case "select_all_images":
          return await goDaemonClient.selectAllImages(p?.selected as boolean);
        case "get_image_tags":
          return await goDaemonClient.getImageTags();
        case "get_image_history":
          return await goDaemonClient.getImageHistory(
            p?.limit as number | undefined,
            p?.monitor as string | undefined,
          );
        case "clear_image_history":
          return await goDaemonClient.clearImageHistory();

        // WALLPAPER
        case "get_current_wallpapers":
          return await goDaemonClient.getCurrentWallpapers();
        case "set_wallpaper":
          return await goDaemonClient.setWallpaper(
            p?.image_id as number,
            (p?.monitor as string) || "*",
            (p?.mode as MonitorMode) || "individual",
            p?.monitors as string[] | undefined,
          );
        case "random_wallpaper":
          return await goDaemonClient.setRandomWallpaper(
            (p?.monitor as string) || "*",
            (p?.mode as MonitorMode) || "individual",
          );

        // PLAYLISTS
        case "get_playlists":
          return await goDaemonClient.getPlaylists();
        case "get_playlist":
          return await goDaemonClient.getPlaylist(p?.id as number);
        case "create_playlist":
          return await goDaemonClient.createPlaylist(p as unknown as CreatePlaylistRequest);
        case "update_playlist":
          return await goDaemonClient.updatePlaylist(
            p?.id as number,
            p?.update as UpdatePlaylistRequest,
          );
        case "delete_playlist":
          return await goDaemonClient.deletePlaylist(p?.id as number);
        case "start_playlist":
          return await goDaemonClient.startPlaylist(
            p?.id as number,
            (p?.monitor as string) || "*",
            (p?.mode as MonitorMode) || "individual",
          );
        case "stop_playlist":
          return await goDaemonClient.stopPlaylist(p?.id as number);
        case "pause_playlist":
          return await goDaemonClient.pausePlaylist(p?.id as number);
        case "resume_playlist":
          return await goDaemonClient.resumePlaylist(p?.id as number);
        case "next_playlist_image":
          return await goDaemonClient.nextPlaylistImage(p?.id as number);
        case "previous_playlist_image":
          return await goDaemonClient.previousPlaylistImage(p?.id as number);
        case "get_active_playlists":
          return await goDaemonClient.getActivePlaylists();
        case "get_active_playlist_for_monitor":
          return await goDaemonClient.getActivePlaylistForMonitor(p?.monitor as string);
        case "stop_all_playlists":
          return await goDaemonClient.stopAllPlaylists();
        case "pause_all_playlists":
          return await goDaemonClient.pauseAllPlaylists();
        case "resume_all_playlists":
          return await goDaemonClient.resumeAllPlaylists();

        // FOLDERS
        case "get_folders":
          return await goDaemonClient.getFolders(
            p?.parent_id as number | undefined,
            p?.search as string | undefined,
          );
        case "get_folder":
          return await goDaemonClient.getFolder(p?.id as number);
        case "get_folder_path":
          return await goDaemonClient.getFolderPath(p?.id as number);
        case "create_folder":
          return await goDaemonClient.createFolder(
            p?.name as string,
            p?.parent_id as number | undefined,
          );
        case "update_folder":
          return await goDaemonClient.updateFolder(
            p?.id as number,
            p?.update as { name?: string; parent_id?: number | null },
          );
        case "delete_folder":
          return await goDaemonClient.deleteFolder(
            p?.id as number,
            (p?.mode as "keep_contents" | "delete_all") || "keep_contents",
          );
        case "move_images_to_folder":
          return await goDaemonClient.moveImagesToFolder(
            p?.image_ids as number[],
            p?.folder_id as number | null,
          );

        // MONITORS
        case "get_monitors":
          return await goDaemonClient.getMonitors();
        case "get_monitor":
          return await goDaemonClient.getMonitor(p?.name as string);

        // CONFIG
        case "get_config":
          return await goDaemonClient.getConfig();
        case "update_config":
          return await goDaemonClient.updateConfig(p as unknown as Partial<UnifiedConfig>);
        case "get_config_section":
          return await goDaemonClient.getConfigSection(p?.section as string);
        case "update_config_section":
          return await goDaemonClient.updateConfigSection(
            p?.section as string,
            p?.data as Record<string, unknown>,
          );
        case "get_backend_config":
          return await goDaemonClient.getBackendConfig();
        case "update_backend_config":
          return await goDaemonClient.updateBackendConfig(p as unknown as Partial<SwwwConfig>);

        // BACKENDS
        case "get_backends":
          return await goDaemonClient.getBackends();
        case "activate_backend":
          return await goDaemonClient.activateBackend(p?.name as string);

        default:
          throw new Error(`Unknown Go daemon action: ${action}`);
      }
    } catch (error) {
      logger.error({ err: error, action }, "Go daemon command failed");
      throw error;
    }
  }

  private setupGoDaemonEventForwarding(): void {
    const events = [
      "processing_started",
      "image_processed",
      "image_error",
      "processing_complete",
      "processing_cancelled",
      "wallpaper_changed",
      "playlist_started",
      "playlist_stopped",
      "playlist_paused",
      "playlist_resumed",
      "playlist_image_changed",
      "monitor_connected",
      "monitor_disconnected",
      "config_changed",
      "history_cleared",
      "images_updated",
      "playlists_updated",
      "folders_updated",
    ];

    for (const eventName of events) {
      goDaemonClient.on(eventName, (data) => {
        this.broadcastToAllWindows(`go-daemon-event-${eventName}`, data);
      });
    }

    goDaemonClient.on("sseDisconnected", () => {
      this.broadcastToAllWindows("go-daemon-event-sse_disconnected", {});
    });
    goDaemonClient.on("sseReconnected", () => {
      this.broadcastToAllWindows("go-daemon-event-sse_reconnected", {});
    });
  }

  private setupThemeHandlers(): void {
    this.registerHandler({
      channel: "get-native-theme",
      handler: async () => {
        const { nativeTheme } = require("electron");
        return {
          shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
          shouldUseHighContrastColors: nativeTheme.shouldUseHighContrastColors,
          shouldUseInvertedColorScheme: nativeTheme.shouldUseInvertedColorScheme,
          themeSource: nativeTheme.themeSource,
        };
      },
    });

    this.registerHandler({
      channel: "set-theme-source",
      handler: async (_event, ...args: unknown[]) => {
        const source = args[0] as "system" | "light" | "dark";
        const { nativeTheme } = require("electron");
        nativeTheme.themeSource = source;
        return true;
      },
    });

    this.registerHandler({
      channel: "theme-changed",
      handler: async (_event, ...args: unknown[]) => {
        const themeName = args[0] as string;
        this.broadcastToAllWindows("theme-changed", { themeName });
        return true;
      },
    });
  }

  private setupWindowHandlers(): void {
    this.registerHandler({
      channel: "minimize-window",
      handler: async (event) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (!window) return false;
        window.minimize();
        return true;
      },
    });

    this.registerHandler({
      channel: "maximize-window",
      handler: async (event) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (!window) return false;
        if (window.isMaximized()) {
          window.unmaximize();
        } else {
          window.maximize();
        }
        return true;
      },
    });

    this.registerHandler({
      channel: "close-window",
      handler: async (event) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (!window) return false;
        window.close();
        return true;
      },
    });

    this.registerHandler({
      channel: "hide-window",
      handler: async (event) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (!window) return false;
        window.hide();
        return true;
      },
    });

    this.registerHandler({
      channel: "show-window",
      handler: async (event) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (!window) return false;
        window.show();
        return true;
      },
    });
  }

  private setupWallhavenHandlers(): void {
    this.registerHandler({
      channel: "wallhaven-search",
      handler: async (_event, ...args) => {
        const params = args[0] as Record<string, string>;
        const url = new URL("https://wallhaven.cc/api/v1/search");
        for (const [k, v] of Object.entries(params)) {
          if (v !== undefined && v !== "" && k !== "apikey") url.searchParams.set(k, v);
        }
        try {
          const config = await goDaemonClient.getConfig();
          const apiKey = config?.wallhaven?.api_key;
          if (apiKey) url.searchParams.set("apikey", apiKey);
        } catch {
          // Config unavailable, proceed without key
        }
        const res = await fetch(url.toString());
        if (!res.ok) throw new Error(`Wallhaven API error: ${res.status}`);
        return res.json();
      },
    });

    this.registerHandler({
      channel: "wallhaven-wallpaper",
      handler: async (_event, ...args) => {
        const id = args[0] as string;
        const url = new URL(`https://wallhaven.cc/api/v1/w/${id}`);
        try {
          const config = await goDaemonClient.getConfig();
          const apiKey = config?.wallhaven?.api_key;
          if (apiKey) url.searchParams.set("apikey", apiKey);
        } catch {
          // Config unavailable, proceed without key
        }
        const res = await fetch(url.toString());
        if (!res.ok) throw new Error(`Wallhaven API error: ${res.status}`);
        return res.json();
      },
    });

    this.registerHandler({
      channel: "wallhaven-test-key",
      handler: async (_event, ...args) => {
        const apiKey = args[0] as string;
        const res = await fetch(
          `https://wallhaven.cc/api/v1/settings?apikey=${encodeURIComponent(apiKey)}`,
        );
        if (!res.ok) throw new Error(`Wallhaven API key test failed: ${res.status}`);
        return res.json();
      },
    });

    this.registerHandler({
      channel: "wallhaven-download",
      handler: async (_event, ...args) => {
        const url = args[0] as string;
        const parsed = new URL(url);
        const allowedHosts = ["w.wallhaven.cc", "th.wallhaven.cc", "wallhaven.cc"];
        if (parsed.protocol !== "https:" || !allowedHosts.includes(parsed.hostname)) {
          throw new Error("Only Wallhaven CDN URLs are allowed");
        }
        return this.downloadToTemp(url, "wallhaven");
      },
    });
  }

  private setupDownloadHandlers(): void {
    this.registerHandler({
      channel: "download-url",
      handler: async (_event, ...args) => {
        const url = args[0] as string;
        const parsed = new URL(url);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          throw new Error("Only http/https URLs are supported");
        }
        return this.downloadToTemp(url, "import");
      },
    });
  }

  private setupErrorHandling(): void {
    process.on("uncaughtException", (error) => {
      logger.error({ err: error }, "Uncaught Exception");
      this.broadcastToAllWindows("app-error", {
        error: error.message,
        stack: error.stack,
      });
    });

    process.on("unhandledRejection", (reason, _promise) => {
      logger.error({ err: reason }, "Unhandled Rejection");
      this.broadcastToAllWindows("app-error", {
        error: "Unhandled Promise Rejection",
        reason: reason?.toString(),
      });
    });
  }

  private setupRendererLogging(): void {
    const rendererLogger = logger.child({ module: "renderer" });
    ipcMain.on(
      "log-to-main",
      (_event, payload: { level: string; message: string; data?: Record<string, unknown> }) => {
        const { level, message, data } = payload;
        const ctx = data ?? {};
        switch (level) {
          case "debug":
            rendererLogger.debug(ctx, message);
            break;
          case "info":
            rendererLogger.info(ctx, message);
            break;
          case "warn":
            rendererLogger.warn(ctx, message);
            break;
          case "error":
            rendererLogger.error(ctx, message);
            break;
          default:
            rendererLogger.info(ctx, message);
        }
      },
    );
  }

  private async downloadToTemp(url: string, prefix = "download"): Promise<string> {
    const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"]);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const rawExt = url.slice(url.lastIndexOf(".")).split("?")[0].toLowerCase();
    const ext = ALLOWED_EXTENSIONS.has(rawExt) ? rawExt : ".jpg";
    const tmpPath = join(tmpdir(), `${prefix}-${randomUUID()}${ext}`);
    await writeFile(tmpPath, buf);
    return tmpPath;
  }

  private broadcastToAllWindows(channel: string, data: unknown): void {
    this.windows.forEach((window) => {
      if (!window.isDestroyed()) {
        window.webContents.send(channel, data);
      }
    });
  }

  private async handleExitApp(): Promise<boolean> {
    try {
      const config = await goDaemonClient.getConfig();
      const shouldStopDaemon = config?.app?.kill_daemon_on_exit ?? false;

      if (shouldStopDaemon) {
        await goDaemonClient.shutdown();
      }

      this.windows.forEach((window) => {
        if (!window.isDestroyed()) {
          window.close();
        }
      });

      app.quit();
      return true;
    } catch (error) {
      logger.error({ err: error }, "Error during application exit");
      app.quit();
      return false;
    }
  }

  cleanup(): void {
    this.handlers.forEach((_handler, channel) => {
      ipcMain.removeHandler(channel);
    });
    this.handlers.clear();
    this.windows.clear();
    this.isInitialized = false;
  }
}

export default IPCManager;
