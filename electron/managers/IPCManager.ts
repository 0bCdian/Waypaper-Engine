import { ipcMain, BrowserWindow, dialog, app, shell } from "electron";
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
  atomPathToFs,
  exportWallpapersToDirectory,
  type ExportWallpaperPayload,
} from "../exportWallpapersToFolder";
import { cancelYoutubeDownload, isYtDlpAvailable, startYoutubeDownload } from "../youtubeDownload";

function toAtomUrl(path: string): string {
  return path.startsWith("atom:") ? path : `atom://${resolve(path).substring(1)}`;
}

function withAtomPaths(image: Image): Image {
  const thumbnails = Object.fromEntries(
    Object.entries(image.thumbnails ?? {}).map(([size, path]) => [size, path && toAtomUrl(path)]),
  ) as Image["thumbnails"];
  return {
    ...image,
    path: image.path && toAtomUrl(image.path),
    preview_path: image.preview_path && toAtomUrl(image.preview_path),
    thumbnails,
  };
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
    this.setupWallhavenHandlers();
    this.setupDownloadHandlers();
    this.setupErrorHandling();
    this.setupRendererLogging();

    this.isInitialized = true;
  }

  registerWindow(window: BrowserWindow): void {
    this.windows.add(window);
  }

  /** Broadcasts a system-resume signal to all renderer windows so they can resync daemon state. */
  notifySystemResumed(): void {
    this.broadcastToAllWindows("go-daemon-event-system_resumed", {});
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
          if (!folderName && result.filePaths[0]) {
            const first = result.filePaths[0];
            folderName = first.split("/").pop() || first.split("\\").pop();
          }
          const scans = await Promise.all(
            result.filePaths.map((folderPath) => scanDirectoryForImports(folderPath)),
          );
          for (const scanned of scans) {
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

        await goDaemonClient.images.importImages(files, folderId);

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
        shell.showItemInFolder(atomPathToFs(args[0] as string));
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
      channel: "check-yt-dlp",
      handler: async () => {
        return { available: await isYtDlpAvailable() };
      },
    });

    this.registerHandler({
      channel: "youtube-download-start",
      handler: async (_event, ...args: unknown[]) => {
        const payload = args[0] as { url?: string };
        const url = typeof payload?.url === "string" ? payload.url : "";
        const r = await startYoutubeDownload(url, (downloadEvent) => {
          this.broadcastToAllWindows("youtube-download-event", downloadEvent);
        });
        if (!r.ok) {
          throw new Error(r.message);
        }
        return { jobId: r.jobId };
      },
    });

    this.registerHandler({
      channel: "youtube-download-cancel",
      handler: async (_event, ...args: unknown[]) => {
        const payload = args[0] as { jobId?: string };
        const jobId = typeof payload?.jobId === "string" ? payload.jobId : "";
        return { canceled: cancelYoutubeDownload(jobId) };
      },
    });
  }

  private async handleDaemonRequest(req: DaemonRequest): Promise<unknown> {
    try {
      switch (req.type) {
        case "get_capabilities":
          return await goDaemonClient.health.getCapabilities();

        case "get_images": {
          const result = await goDaemonClient.images.getImages(req.params);
          result.data = result.data.map(withAtomPaths);
          return result;
        }
        case "get_image": {
          const image = await goDaemonClient.images.getImage(req.id);
          return withAtomPaths(image);
        }
        case "ensure_browser_preview": {
          const image = await goDaemonClient.images.ensureBrowserPreview(req.id, req.force);
          return withAtomPaths(image);
        }
        case "video_loop_export": {
          const r = await goDaemonClient.images.videoLoopExport(req.id, req.body);
          return {
            ...r,
            path: r.path && toAtomUrl(r.path),
          };
        }
        case "extract_video_palette": {
          await goDaemonClient.images.extractVideoPalette(req.id, req.body);
          const image = await goDaemonClient.images.getImage(req.id);
          return { colors: image.colors ?? [], image_id: req.id, image: withAtomPaths(image) };
        }
        case "import_images":
          return await goDaemonClient.images.importImages(req.paths, req.folder_id ?? undefined);
        case "import_web_wallpaper": {
          const imported = await goDaemonClient.images.importWebWallpaper(
            req.path,
            req.folder_id ?? undefined,
          );
          return withAtomPaths(imported);
        }
        case "cancel_import":
          return await goDaemonClient.images.cancelImport(req.batch_id);
        case "delete_images":
          return await goDaemonClient.images.deleteImages(req.ids);
        case "update_image": {
          const updated = await goDaemonClient.images.updateImage(req.id, req.update);
          return withAtomPaths(updated);
        }
        case "get_image_tags":
          return await goDaemonClient.images.getImageTags();
        case "get_image_history":
          return await goDaemonClient.images.getImageHistory(req.limit, req.monitor);
        case "clear_image_history":
          return await goDaemonClient.images.clearImageHistory();

        case "get_current_wallpapers":
          return await goDaemonClient.wallpaper.getCurrentWallpapers();
        case "set_wallpaper":
          return await goDaemonClient.wallpaper.setWallpaper(
            req.image_id,
            req.monitor || "*",
            req.mode || "individual",
            req.monitors,
          );
        case "random_wallpaper":
          return await goDaemonClient.wallpaper.setRandomWallpaper(
            req.monitor || "*",
            req.mode || "individual",
          );

        case "get_playlists":
          return await goDaemonClient.playlists.getPlaylists();
        case "get_playlist":
          return await goDaemonClient.playlists.getPlaylist(req.id);
        case "create_playlist":
          return await goDaemonClient.playlists.createPlaylist(req.playlist);
        case "update_playlist":
          return await goDaemonClient.playlists.updatePlaylist(req.id, req.update);
        case "delete_playlist":
          return await goDaemonClient.playlists.deletePlaylist(req.id);
        case "start_playlist":
          return await goDaemonClient.playlists.startPlaylist(req.id, req.monitors, req.extend);
        case "stop_playlist":
          return await goDaemonClient.playlists.stopPlaylist(req.id);
        case "pause_playlist":
          return await goDaemonClient.playlists.pausePlaylist(req.id);
        case "resume_playlist":
          return await goDaemonClient.playlists.resumePlaylist(req.id);
        case "next_playlist_image":
          return await goDaemonClient.playlists.nextPlaylistImage(req.id);
        case "previous_playlist_image":
          return await goDaemonClient.playlists.previousPlaylistImage(req.id);
        case "get_active_playlists":
          return await goDaemonClient.playlists.getActivePlaylists();

        case "get_folders":
          return await goDaemonClient.folders.getFolders(req.parent_id ?? undefined, req.search);
        case "get_folder_path":
          return await goDaemonClient.folders.getFolderPath(req.id);
        case "create_folder":
          return await goDaemonClient.folders.createFolder(req.name, req.parent_id ?? undefined);
        case "update_folder":
          return await goDaemonClient.folders.updateFolder(req.id, req.update);
        case "delete_folder":
          return await goDaemonClient.folders.deleteFolder(req.id, req.mode || "keep_contents");
        case "move_images_to_folder":
          return await goDaemonClient.folders.moveImagesToFolder(req.image_ids, req.folder_id);

        case "get_monitors":
          return await goDaemonClient.monitors.getMonitors();

        case "get_config":
          return await goDaemonClient.control.getConfig();
        case "update_config":
          return await goDaemonClient.control.updateConfig(req.config);
        case "update_config_section":
          return await goDaemonClient.control.updateConfigSection(req.section, req.data);
        case "get_backend_config":
          return await goDaemonClient.control.getBackendConfig(req.name);
        case "update_backend_config":
          return await goDaemonClient.control.updateBackendConfig(req.name, req.patch);

        case "reset_all_config":
          return await goDaemonClient.control.resetAllConfig();

        case "reset_backend_config":
          return await goDaemonClient.control.resetBackendConfig(req.name);

        case "get_backends":
          return await goDaemonClient.control.getBackends();
        case "activate_backend":
          return await goDaemonClient.control.activateBackend(req.name);

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
          const config = await goDaemonClient.control.getConfig();
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
          const config = await goDaemonClient.control.getConfig();
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
    });
    process.on("unhandledRejection", (reason) => {
      logger.error({ err: reason }, "Unhandled Rejection");
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
        const log = ["debug", "info", "warn", "error"].includes(level)
          ? rendererLogger[level as "debug" | "info" | "warn" | "error"]
          : rendererLogger.info;
        log.call(rendererLogger, data ?? {}, message);
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
      const config = await goDaemonClient.control.getConfig();
      const shouldStopDaemon = config?.app?.kill_daemon_on_exit ?? false;

      if (shouldStopDaemon) {
        await goDaemonClient.health.shutdown();
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
