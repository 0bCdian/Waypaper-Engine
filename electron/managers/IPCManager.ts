/**
 * IPC Manager for Electron Main Process
 *
 * Centralized IPC handler management. Routes renderer requests to the
 * Go daemon HTTP client and forwards SSE events back to renderer windows.
 */

import { ipcMain, BrowserWindow, dialog, app } from "electron";
import { resolve } from "node:path";
import { mkdtemp, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { goDaemonClient } from "../goDaemonClient";
import { daemonMonitor } from "./DaemonMonitor";
import { logger } from "../logger";
import type { Image } from "../daemon-go-types";
import type { DaemonRequest } from "../ipc-types";
import { scanDirectoryForImports } from "../scanDirectoryForImports";
import {
  buildShaderMultipassWebWallpaperFiles,
  buildShaderWebWallpaperFiles,
  type MultipassPayload,
  type ShaderWebWallpaperFiles,
} from "../../src/shaderStudio/buildWallpaperPackage";
import { ensureDaemonActionSuccess } from "../ipcEnvelope";
import { writeAnimatedWebpPreviewFromPngs } from "../shaderWallpaperPreviewWriter";
import { MAX_PREVIEW_FRAMES } from "../../src/shaderStudio/captureShaderPreviewPngs";
import {
  exportWallpapersToDirectory,
  type ExportWallpaperPayload,
} from "../exportWallpapersToFolder";
import { downloadYoutubeVideo } from "../youtubeDownload";

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

    const unwrappedChannels = ["daemon"];

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
        const result = await daemonMonitor.restartDaemon();
        ensureDaemonActionSuccess("restart-daemon", result);
        return result;
      },
    });

    this.registerHandler({
      channel: "start-daemon",
      handler: async () => {
        const result = await daemonMonitor.startDaemon();
        ensureDaemonActionSuccess("start-daemon", result);
        return result;
      },
    });

    this.registerHandler({
      channel: "stop-daemon",
      handler: async () => {
        const result = await daemonMonitor.stopDaemon();
        ensureDaemonActionSuccess("stop-daemon", result);
        return result;
      },
    });
  }

  private setupGoDaemonHandlers(): void {
    this.registerHandler({
      channel: "daemon",
      handler: async (_event, ...args: unknown[]) => {
        const req = args[0] as DaemonRequest;
        return await this.handleDaemonRequest(req);
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
        } else if (action === "video") {
          result = await dialog.showOpenDialog(mainWindow, {
            title: "Select Videos",
            filters: [
              {
                name: "Videos",
                extensions: ["mp4", "webm", "mkv", "avi", "mov"],
              },
              { name: "All Files", extensions: ["*"] },
            ],
            properties: ["openFile", "multiSelections"],
          });
        } else if (action === "web") {
          result = await dialog.showOpenDialog(mainWindow, {
            title: "Select Web Wallpaper (Folder or Manifest)",
            filters: [
              {
                name: "Manifest",
                extensions: ["json"],
              },
              { name: "All Files", extensions: ["*"] },
            ],
            properties: ["openFile", "openDirectory"],
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
          return { files: [], webRoots: [] };
        }

        let files: string[] = [];
        let folderName: string | undefined;

        let webRoots: string[] = [];
        if (action === "folder") {
          for (const folderPath of result.filePaths) {
            if (!folderName) {
              folderName = folderPath.split("/").pop() || folderPath.split("\\").pop();
            }
            const scanned = await scanDirectoryForImports(folderPath);
            files.push(...scanned.mediaFiles);
            webRoots.push(...scanned.webPackageRoots);
          }
        } else {
          files = result.filePaths;
        }

        return { files, webRoots, folderName };
      },
    });

    this.registerHandler({
      channel: "handleOpenImages",
      handler: async (_event, ...args: unknown[]) => {
        const imagesObject = args[0] as { files: string[]; folder_id?: number };
        if (!imagesObject.files || imagesObject.files.length === 0) {
          return { message: "No files to process" };
        }

        const files: string[] = imagesObject.files;
        const folderId = imagesObject.folder_id;

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
        const { mediaFiles, webPackageRoots } = await scanDirectoryForImports(dirPath);
        const folderName = dirPath.split("/").pop() || dirPath.split("\\").pop() || dirPath;
        return { files: mediaFiles, webRoots: webPackageRoots, folderName };
      },
    });

    this.registerHandler({
      channel: "write-shader-web-wallpaper-package",
      handler: async (event, ...args: unknown[]) => {
        type ShaderPkgPayload =
          | {
              kind?: "single";
              shader: string;
              title: string;
              mode: "temp" | "export";
              previewPngBuffers?: unknown[];
              previewFps?: number;
            }
          | {
              kind: "multipass";
              multipass: MultipassPayload;
              title: string;
              mode: "temp" | "export";
              previewPngBuffers?: unknown[];
              previewFps?: number;
            };

        const payload = args[0] as ShaderPkgPayload;

        const title = payload.title;
        const mode = payload.mode;

        const files: ShaderWebWallpaperFiles =
          "kind" in payload && payload.kind === "multipass"
            ? buildShaderMultipassWebWallpaperFiles({
                payload: payload.multipass,
                title,
              })
            : buildShaderWebWallpaperFiles({
                shader: (payload as { shader: string }).shader,
                title,
              });

        const normalizePreviewBuffers = (raw: unknown): Uint8Array[] => {
          if (!Array.isArray(raw)) return [];
          const out: Uint8Array[] = [];
          for (const b of raw) {
            if (out.length >= MAX_PREVIEW_FRAMES) break;
            if (b instanceof Uint8Array) {
              out.push(b);
            } else if (Buffer.isBuffer(b)) {
              out.push(new Uint8Array(b.buffer, b.byteOffset, b.byteLength));
            }
          }
          return out;
        };
        const previewBuffers = normalizePreviewBuffers(payload.previewPngBuffers);
        const previewFps =
          typeof payload.previewFps === "number" && Number.isFinite(payload.previewFps)
            ? Math.min(120, Math.max(1, Math.round(payload.previewFps)))
            : 24;

        const writeCoreFiles = async (dir: string): Promise<void> => {
          await writeFile(join(dir, "waypaper.json"), files["waypaper.json"], "utf8");
          await writeFile(join(dir, "index.html"), files["index.html"], "utf8");
          if (previewBuffers.length > 0) {
            await writeAnimatedWebpPreviewFromPngs(dir, previewBuffers, previewFps);
          }
        };

        if (mode === "temp") {
          const dir = await mkdtemp(join(tmpdir(), "waypaper-shader-"));
          await writeCoreFiles(dir);
          return { canceled: false as const, packageDir: dir };
        }
        const mainWindow = BrowserWindow.fromWebContents(event.sender);
        if (!mainWindow) {
          throw new Error("No window available");
        }
        const result = await dialog.showOpenDialog(mainWindow, {
          title: "Export shader web wallpaper — choose folder",
          properties: ["openDirectory", "createDirectory"],
        });
        if (result.canceled || !result.filePaths[0]) {
          return { canceled: true as const, packageDir: "" };
        }
        const dir = result.filePaths[0];
        await writeCoreFiles(dir);
        return { canceled: false as const, packageDir: dir };
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

    this.registerHandler({
      channel: "export-wallpapers-to-folder",
      handler: async (event, ...args: unknown[]) => {
        const items = args[0] as ExportWallpaperPayload[];
        if (!Array.isArray(items) || items.length === 0) {
          return { canceled: false, destination: "", exported: 0, failed: 0 };
        }
        const mainWindow = BrowserWindow.fromWebContents(event.sender);
        if (!mainWindow) {
          throw new Error("No window available");
        }
        const picked = await dialog.showOpenDialog(mainWindow, {
          title: "Export wallpapers — choose folder",
          properties: ["openDirectory", "createDirectory"],
        });
        if (picked.canceled || !picked.filePaths[0]) {
          return { canceled: true, destination: "", exported: 0, failed: 0 };
        }
        const dest = picked.filePaths[0]!;
        const { exported, failed } = await exportWallpapersToDirectory(dest, items);
        return { canceled: false, destination: dest, exported, failed };
      },
    });

    this.registerHandler({
      channel: "download-youtube-video",
      handler: async (_event, ...args: unknown[]) => {
        const payload = args[0] as { url?: string };
        const url = typeof payload?.url === "string" ? payload.url : "";
        const r = await downloadYoutubeVideo(url);
        if (!r.ok) {
          throw new Error(r.message);
        }
        return { filePath: r.filePath };
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

      if (converted.preview_path && !converted.preview_path.startsWith("atom:")) {
        const pp = converted.preview_path;
        if (pp.startsWith("/")) {
          converted.preview_path = `atom://${pp.substring(1)}`;
        } else {
          const absolutePath = resolve(pp);
          converted.preview_path = `atom://${absolutePath.substring(1)}`;
        }
      }

      return converted;
    });
  }

  private async handleDaemonRequest(req: DaemonRequest): Promise<unknown> {
    try {
      switch (req.type) {
        // HEALTH & SYSTEM
        case "ping":
          return await goDaemonClient.ping();
        case "get_info":
          return await goDaemonClient.getInfo();
        case "get_capabilities":
          return await goDaemonClient.getCapabilities();
        case "shutdown":
          await goDaemonClient.shutdown();
          return { status: "shutting_down" };

        // IMAGES
        case "get_images": {
          const result = await goDaemonClient.getImages(req.params);
          result.data = this.convertPathsToAtomProtocol(result.data);
          return result;
        }
        case "get_image": {
          const image = await goDaemonClient.getImage(req.id);
          return this.convertPathsToAtomProtocol([image])[0];
        }
        case "ensure_browser_preview": {
          const image = await goDaemonClient.ensureBrowserPreview(req.id, req.force);
          return this.convertPathsToAtomProtocol([image])[0];
        }
        case "video_loop_export": {
          const r = await goDaemonClient.videoLoopExport(req.id, req.body);
          return {
            ...r,
            path: r.path?.startsWith("/") ? `atom://${r.path.substring(1)}` : r.path,
          };
        }
        case "extract_video_palette": {
          const r = await goDaemonClient.extractVideoPalette(req.id, req.body);
          const img = this.convertPathsToAtomProtocol([r.image])[0];
          return { colors: r.colors, image: img };
        }
        case "import_images":
          return await goDaemonClient.importImages(req.paths, req.folder_id ?? undefined);
        case "import_web_wallpaper": {
          const imported = await goDaemonClient.importWebWallpaper(
            req.path,
            req.folder_id ?? undefined,
          );
          return this.convertPathsToAtomProtocol([imported])[0];
        }
        case "cancel_import":
          return await goDaemonClient.cancelImport(req.batch_id);
        case "delete_images":
          return await goDaemonClient.deleteImages(req.ids);
        case "update_image": {
          const updated = await goDaemonClient.updateImage(req.id, req.update);
          return this.convertPathsToAtomProtocol([updated])[0];
        }
        case "select_all_images":
          return await goDaemonClient.selectAllImages(req.selected);
        case "get_image_tags":
          return await goDaemonClient.getImageTags();
        case "get_image_history":
          return await goDaemonClient.getImageHistory(req.limit, req.monitor);
        case "clear_image_history":
          return await goDaemonClient.clearImageHistory();

        // WALLPAPER
        case "get_current_wallpapers":
          return await goDaemonClient.getCurrentWallpapers();
        case "set_wallpaper":
          return await goDaemonClient.setWallpaper(
            req.image_id,
            req.monitor || "*",
            req.mode || "individual",
            req.monitors,
          );
        case "random_wallpaper":
          return await goDaemonClient.setRandomWallpaper(
            req.monitor || "*",
            req.mode || "individual",
          );

        // PLAYLISTS
        case "get_playlists":
          return await goDaemonClient.getPlaylists();
        case "get_playlist":
          return await goDaemonClient.getPlaylist(req.id);
        case "create_playlist":
          return await goDaemonClient.createPlaylist(req.playlist);
        case "update_playlist":
          return await goDaemonClient.updatePlaylist(req.id, req.update);
        case "delete_playlist":
          return await goDaemonClient.deletePlaylist(req.id);
        case "start_playlist":
          return await goDaemonClient.startPlaylist(
            req.id,
            req.monitor || "*",
            req.mode || "individual",
          );
        case "stop_playlist":
          return await goDaemonClient.stopPlaylist(req.id);
        case "pause_playlist":
          return await goDaemonClient.pausePlaylist(req.id);
        case "resume_playlist":
          return await goDaemonClient.resumePlaylist(req.id);
        case "next_playlist_image":
          return await goDaemonClient.nextPlaylistImage(req.id);
        case "previous_playlist_image":
          return await goDaemonClient.previousPlaylistImage(req.id);
        case "get_active_playlists":
          return await goDaemonClient.getActivePlaylists();
        case "get_active_playlist_for_monitor":
          return await goDaemonClient.getActivePlaylistForMonitor(req.monitor);
        case "stop_all_playlists":
          return await goDaemonClient.stopAllPlaylists();

        // FOLDERS
        case "get_folders":
          return await goDaemonClient.getFolders(req.parent_id ?? undefined, req.search);
        case "get_folder":
          return await goDaemonClient.getFolder(req.id);
        case "get_folder_path":
          return await goDaemonClient.getFolderPath(req.id);
        case "create_folder":
          return await goDaemonClient.createFolder(req.name, req.parent_id ?? undefined);
        case "update_folder":
          return await goDaemonClient.updateFolder(req.id, req.update);
        case "delete_folder":
          return await goDaemonClient.deleteFolder(req.id, req.mode || "keep_contents");
        case "move_images_to_folder":
          return await goDaemonClient.moveImagesToFolder(req.image_ids, req.folder_id);

        // MONITORS
        case "get_monitors":
          return await goDaemonClient.getMonitors();
        case "get_monitor":
          return await goDaemonClient.getMonitor(req.name);

        // CONFIG
        case "get_config":
          return await goDaemonClient.getConfig();
        case "update_config":
          return await goDaemonClient.updateConfig(req.config);
        case "get_config_section":
          return await goDaemonClient.getConfigSection(req.section);
        case "update_config_section":
          return await goDaemonClient.updateConfigSection(req.section, req.data);
        case "get_backend_config":
          return await goDaemonClient.getBackendConfig(req.name);
        case "update_backend_config":
          return await goDaemonClient.updateBackendConfig(req.name, req.patch);

        case "reset_all_config":
          return await goDaemonClient.resetAllConfig();

        case "reset_backend_config":
          return await goDaemonClient.resetBackendConfig(req.name);

        // BACKENDS
        case "get_backends":
          return await goDaemonClient.getBackends();
        case "get_backend_capabilities": {
          const [cfg, backends] = await Promise.all([
            goDaemonClient.getConfig(),
            goDaemonClient.getBackends(),
          ]);
          const active = backends.find((b) => b.name === cfg.backend.type);
          return active?.capabilities ?? null;
        }
        case "activate_backend":
          return await goDaemonClient.activateBackend(req.name);

        default: {
          const _exhaustive: never = req;
          throw new Error(`unknown daemon request type: ${(_exhaustive as DaemonRequest).type}`);
        }
      }
    } catch (error) {
      logger.error({ err: error, type: req.type }, "Daemon request failed");
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
      "playlist_skipped_incompatible",
      "playlist_no_compatible_item",
      "monitor_connected",
      "monitor_disconnected",
      "config_changed",
      "gallery_changed",
      "backend_unavailable",
      "wallpaper_restore_failed",
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
      (
        _event,
        payload: {
          level: string;
          message: string;
          data?: Record<string, unknown>;
        },
      ) => {
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
