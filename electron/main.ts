import { createReadStream } from "node:fs";
import { access as fsAccess, stat as fsStat } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { Readable } from "node:stream";
import {
  Tray,
  app,
  type BrowserWindow,
  globalShortcut,
  nativeImage,
  powerMonitor,
  protocol,
  Notification,
} from "electron";

import { logger } from "./logger";
import { spawnBundledDaemonAndExit } from "./daemonForward";
import { initWaypaperDaemon } from "../globals/startDaemons";
import { goDaemonClient } from "./goDaemonClient";
import { trayMenu } from "../globals/menus";
import { daemonMonitor } from "./managers/DaemonMonitor";
import { IPCManager } from "./managers/IPCManager";
import { WindowManager } from "./managers/WindowManager";

/** Force MIME for atom:// so <video>/<img> can sniff type (file:// often returns octet-stream). */
const ATOM_MIME_BY_EXT: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".avi": "video/x-msvideo",
  ".mov": "video/quicktime",
  ".gif": "image/gif",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
  ".html": "text/html",
  ".htm": "text/html",
  ".json": "application/json",
};

/**
 * Parse a single Range: bytes=… value. Returns null when the range is not satisfiable.
 * Chromium video elements use byte-range requests; without 206 + Content-Range, MP4 often fails to load (MEDIA_ERR_SRC_NOT_SUPPORTED).
 */
function parseRangeHeader(
  rangeHeader: string,
  size: number,
): { start: number; end: number } | null {
  const [unit, rest] = rangeHeader.split("=");
  if (unit.trim().toLowerCase() !== "bytes" || !rest) return null;
  const spec = rest.trim().split(",")[0].trim();
  if (spec.startsWith("-")) {
    const suffix = parseInt(spec.slice(1), 10);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    const start = Math.max(0, size - suffix);
    return { start, end: size - 1 };
  }
  const dash = spec.indexOf("-");
  if (dash < 0) return null;
  const startStr = spec.slice(0, dash);
  const endStr = spec.slice(dash + 1);
  let start = startStr === "" ? 0 : parseInt(startStr, 10);
  let end = endStr === "" ? size - 1 : parseInt(endStr, 10);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start >= size) return null;
  end = Math.min(end, size - 1);
  if (start > end) return null;
  return { start, end };
}

async function atomProtocolResponse(request: Request, filePath: string): Promise<Response> {
  const ext = extname(filePath).toLowerCase();
  const mime = ATOM_MIME_BY_EXT[ext] ?? "application/octet-stream";
  const { size } = await fsStat(filePath);

  const rangeHeader = request.headers.get("range");
  if (rangeHeader) {
    const range = parseRangeHeader(rangeHeader, size);
    if (!range) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
    }
    const { start, end } = range;
    const chunkSize = end - start + 1;
    const nodeStream = createReadStream(filePath, { start, end });
    const webStream = Readable.toWeb(nodeStream as unknown as NodeJS.ReadableStream);
    return new Response(webStream as unknown as BodyInit, {
      status: 206,
      headers: {
        "Content-Type": mime,
        "Content-Length": String(chunkSize),
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Accept-Ranges": "bytes",
      },
    });
  }

  const nodeStream = createReadStream(filePath);
  const webStream = Readable.toWeb(nodeStream as unknown as NodeJS.ReadableStream);
  return new Response(webStream as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Length": String(size),
      "Accept-Ranges": "bytes",
    },
  });
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let windowManager: WindowManager;
let ipcManager: IPCManager;

async function createMainWindow(): Promise<void> {
  windowManager = new WindowManager();
  await windowManager.loadConfig();
  mainWindow = windowManager.createWindow();

  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, "../dist/index.html"));
  }

  if (process.env.NODE_ENV !== "development") {
    mainWindow.webContents.on("before-input-event", (event, input) => {
      if (
        input.key === "F5" ||
        (input.key === "r" && (input.control || input.meta)) ||
        (input.key === "R" && (input.control || input.meta) && input.shift)
      ) {
        event.preventDefault();
      }
    });
    mainWindow.setMenu(null);
  }

  ipcManager.registerWindow(mainWindow);
  daemonMonitor.registerWindow(mainWindow);
}

/**
 * Create or refresh the system tray icon and context menu.
 */
async function createAppTray(): Promise<void> {
  const isDev = process.env.NODE_ENV === "development";
  const iconPath = isDev
    ? join(__dirname, "../public/app.png")
    : join(__dirname, "../dist/app.png");
  if (!tray) {
    const icon = nativeImage.createFromPath(iconPath);
    tray = new Tray(icon.resize({ width: 22, height: 22 }));
    tray.setToolTip("Waypaper Engine");
    tray.on("click", () => {
      if (mainWindow) {
        if (mainWindow.isVisible() && mainWindow.isFocused()) {
          mainWindow.hide();
        } else if (mainWindow.isVisible()) {
          mainWindow.focus();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });
  }

  const menu = await trayMenu(app, tray, createAppTray);
  tray.setContextMenu(menu);
}

async function initializeApp(): Promise<void> {
  try {
    ipcManager = new IPCManager();
    ipcManager.initialize();

    protocol.handle("atom", async (request) => {
      const url = decodeURI(request.url);
      const rawPath = url.replace("atom://", "/");
      const filePath = resolve(rawPath);

      if (filePath !== rawPath) {
        logger.warn({ rawPath, filePath }, "atom:// path traversal blocked");
        return new Response("Not found", { status: 404 });
      }

      try {
        await fsAccess(filePath);
        return await atomProtocolResponse(request, filePath);
      } catch (error) {
        logger.error({ err: error, filePath }, "Failed to access file");
        return new Response("Not found", { status: 404 });
      }
    });

    daemonMonitor.startMonitoring(5000);

    try {
      logger.info("Initializing waypaper daemon...");
      await initWaypaperDaemon();
      logger.info("Daemon initialized successfully");

      await goDaemonClient.connect();
      logger.info("Connected to daemon successfully");
    } catch (error) {
      logger.error({ err: error }, "Failed to initialize daemon");
      const { dialog: electronDialog } = await import("electron");
      electronDialog.showErrorBox(
        "Waypaper Engine — Daemon Error",
        `The daemon process failed to start. The application cannot function without it.\n\n${error instanceof Error ? error.message : String(error)}`,
      );
      app.exit(1);
      return;
    }

    try {
      await createAppTray();
      logger.info("Tray icon created");

      goDaemonClient.on("wallpaper_changed", () => {
        void createAppTray();
      });

      setupNativeNotifications();

      // Resync daemon state when the system resumes from suspend — nothing else
      // in the stack knows a suspend happened, and cached state (e.g. monitors)
      // goes stale across it.
      powerMonitor.on("resume", () => {
        logger.info("system resumed from suspend; requesting state resync");
        ipcManager.notifySystemResumed();
      });
    } catch (error) {
      logger.error({ err: error }, "Failed to create tray icon");
    }
  } catch (error) {
    logger.error({ err: error }, "Failed to initialize application");
    throw error;
  }
}

/**
 * Show a native desktop notification when the user can't see in-app toasts
 * (window hidden to tray or minimized to taskbar) and notifications are enabled.
 */
function notifyIfHidden(title: string, body: string): void {
  if (mainWindow?.isVisible() && !mainWindow?.isMinimized()) return;
  if (!windowManager?.cachedConfig?.app?.notifications) return;
  new Notification({ title, body }).show();
}

/**
 * Send native desktop notifications for daemon events when the window is
 * hidden or minimized. In-app toasts handle the visible-window case on the
 * renderer side (useNotifications hook).
 *
 * Skipped: playlist_image_changed (fires too frequently for native notifications).
 */
function setupNativeNotifications(): void {
  goDaemonClient.on("wallpaper_changed", (data: Record<string, unknown>) => {
    const monitors = Array.isArray(data?.monitors)
      ? (data.monitors as string[]).join(", ")
      : "monitor";
    notifyIfHidden("Wallpaper Changed", `Wallpaper set on ${monitors}`);
  });

  goDaemonClient.on("processing_started", (data: Record<string, unknown>) => {
    const total = Number(data?.total ?? 0);
    notifyIfHidden("Import Started", `Importing ${total} images...`);
  });

  goDaemonClient.on("processing_complete", (data: Record<string, unknown>) => {
    const succeeded = Number(data?.succeeded ?? 0);
    const failed = Number(data?.failed ?? 0);
    const msg =
      failed > 0
        ? `Processing complete: ${succeeded} images (${failed} errors)`
        : `Processing complete: ${succeeded} images`;
    notifyIfHidden("Processing Complete", msg);
  });

  goDaemonClient.on("processing_cancelled", (data: Record<string, unknown>) => {
    const succeeded = Number(data?.succeeded ?? 0);
    const total = Number(data?.total ?? 0);
    notifyIfHidden("Import Cancelled", `Import cancelled (${succeeded}/${total} images imported)`);
  });

  goDaemonClient.on("playlist_started", (data: Record<string, unknown>) => {
    const monitor = String(data?.monitor ?? "");
    notifyIfHidden("Playlist Started", `Playlist started${monitor ? ` on ${monitor}` : ""}`);
  });

  goDaemonClient.on("playlist_stopped", (data: Record<string, unknown>) => {
    const monitor = String(data?.monitor ?? "");
    notifyIfHidden("Playlist Stopped", `Playlist stopped${monitor ? ` on ${monitor}` : ""}`);
  });

  goDaemonClient.on("playlist_paused", (data: Record<string, unknown>) => {
    const monitor = String(data?.monitor ?? "");
    notifyIfHidden("Playlist Paused", `Playlist paused${monitor ? ` on ${monitor}` : ""}`);
  });

  goDaemonClient.on("playlist_resumed", (data: Record<string, unknown>) => {
    const monitor = String(data?.monitor ?? "");
    notifyIfHidden("Playlist Resumed", `Playlist resumed${monitor ? ` on ${monitor}` : ""}`);
  });

  goDaemonClient.on("monitor_connected", (data: Record<string, unknown>) => {
    notifyIfHidden("Monitor Connected", `Monitor connected: ${String(data?.name ?? "unknown")}`);
  });

  goDaemonClient.on("monitor_disconnected", (data: Record<string, unknown>) => {
    notifyIfHidden(
      "Monitor Disconnected",
      `Monitor disconnected: ${String(data?.name ?? "unknown")}`,
    );
  });

  goDaemonClient.on("sseDisconnected", () => {
    notifyIfHidden("Daemon Connection Lost", "Lost connection to daemon — reconnecting...");
  });

  goDaemonClient.on("sseReconnected", () => {
    notifyIfHidden("Daemon Reconnected", "Reconnected to daemon");
  });
}

function setupAppEvents(): void {
  app.whenReady().then(async () => {
    try {
      if (process.env.NODE_ENV === "development") {
        globalShortcut.register("CommandOrControl+Shift+I", () => {
          if (mainWindow) {
            mainWindow.webContents.toggleDevTools();
          }
        });

        globalShortcut.register("CommandOrControl+R", () => {
          if (mainWindow) {
            mainWindow.reload();
          }
        });
      }

      await initializeApp();
      await createMainWindow();
    } catch (error) {
      logger.error({ err: error }, "Failed to start application");
      app.quit();
    }
  });

  app.on("window-all-closed", () => {
    app.quit();
  });

  // Lets the window "close" handler tell a real quit apart from close-to-tray.
  app.on("before-quit", () => {
    (app as unknown as Record<string, boolean>).isQuitting = true;
  });

  app.on("quit", () => {
    try {
      globalShortcut.unregisterAll();

      const config = windowManager?.cachedConfig;
      if (config?.app?.kill_daemon_on_exit) {
        goDaemonClient.health.shutdown().catch((error) => {
          logger.error({ err: error }, "Failed to stop daemon");
        });
      }

      if (ipcManager) ipcManager.cleanup();
      if (daemonMonitor) daemonMonitor.cleanup();
    } catch (error) {
      logger.error({ err: error }, "Error during shutdown");
    }
  });

  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function setupDevTools(): void {
  if (process.env.NODE_ENV === "development") {
    try {
      require("electron-reload")(__dirname, {
        electron: join(__dirname, "../node_modules/.bin/electron"),
        hardResetMethod: "exit",
      });
    } catch (error) {
      logger.warn({ err: error }, "Live reload not available");
    }
  }
}

function main(): void {
  // `--daemon`: spawn bundled waypaper-daemon detached, exit on spawn — do not
  // touch `app` / windows or Electron will fork helpers and race `process.exit`.
  if (spawnBundledDaemonAndExit(process.argv)) {
    return;
  }

  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
    return;
  }

  setupDevTools();
  setupAppEvents();
}

main();
