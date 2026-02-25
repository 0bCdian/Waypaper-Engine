import { access as fsAccess } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  Tray,
  app,
  type BrowserWindow,
  globalShortcut,
  Menu,
  nativeImage,
  net,
  protocol,
  Notification,
} from "electron";

import { logger } from "./logger";
import { initWaypaperDaemon } from "../globals/startDaemons";
import { goDaemonClient } from "./goDaemonClient";
import { trayMenu } from "../globals/menus";
import { daemonMonitor } from "./managers/DaemonMonitor";
import IPCManager from "./managers/IPCManager";
import ThemeManager from "./managers/ThemeManager";
import WindowManager from "./managers/WindowManager";

// Global variables
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let themeManager: ThemeManager;
let windowManager: WindowManager;
let ipcManager: IPCManager;

// App configuration
const APP_CONFIG = {
  name: "Waypaper Engine",
  version: "2.0.4",
  defaultWidth: 1200,
  defaultHeight: 1000,
};

/**
 * Create the main application window
 */
async function createMainWindow(): Promise<void> {
  // Create window manager and load config before creating the window
  windowManager = new WindowManager(themeManager);
  await windowManager.loadConfig();

  // Create main window
  mainWindow = windowManager.createWindow("main", {
    width: APP_CONFIG.defaultWidth,
    height: APP_CONFIG.defaultHeight,
    backgroundColor: "#323232", // Default dark background
    frame: false, // Always hide the frame for a clean look
    titleBarStyle: "hidden", // Hide the title bar
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
    },
  });

  // Load the app
  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, "../dist/index.html"));
  }

  // Block reload shortcuts in production
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

  // Register with managers
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
    tray.setToolTip(APP_CONFIG.name);
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

/**
 * Initialize the application
 */
async function initializeApp(): Promise<void> {
  try {
    // Initialize theme manager
    themeManager = new ThemeManager();
    themeManager.initialize();

    // Initialize IPC manager
    ipcManager = new IPCManager();
    ipcManager.initialize();

    // Register custom atom:// protocol for file access
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
        return net.fetch(`file://${filePath}`);
      } catch (error) {
        logger.error({ err: error, filePath }, "Failed to access file");
        return new Response("Not found", { status: 404 });
      }
    });

    // Initialize daemon monitor
    daemonMonitor.startMonitoring(5000); // Check every 5 seconds instead of 1 second

    // Initialize and start the daemon
    try {
      logger.info("Initializing waypaper daemon...");
      await initWaypaperDaemon();
      logger.info("Daemon initialized successfully");

      // Connect to the daemon
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

    // Create system tray icon
    try {
      await createAppTray();
      logger.info("Tray icon created");

      // Refresh tray menu when wallpaper changes
      goDaemonClient.on("wallpaper_changed", () => {
        void createAppTray();
      });

      // Native desktop notifications when window is hidden
      setupNativeNotifications();
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

/**
 * Setup application event handlers
 */
function setupAppEvents(): void {
  // App ready
  app.whenReady().then(async () => {
    try {
      // Register global shortcuts
      globalShortcut.register("CommandOrControl+Shift+M", () => {
        const menu = Menu.getApplicationMenu();
        if (menu) {
          Menu.setApplicationMenu(menu);
        } else {
          // Create a minimal menu for development
          const template: Electron.MenuItemConstructorOptions[] = [
            {
              label: "File",
              submenu: [{ role: "quit" }],
            },
            {
              label: "View",
              submenu: [
                { role: "reload" },
                { role: "forceReload" },
                { role: "toggleDevTools" },
                { type: "separator" },
                { role: "resetZoom" },
                { role: "zoomIn" },
                { role: "zoomOut" },
                { type: "separator" },
                { role: "togglefullscreen" },
              ],
            },
          ];
          const devMenu = Menu.buildFromTemplate(template);
          Menu.setApplicationMenu(devMenu);
        }
      });

      // Development shortcuts
      if (process.env.NODE_ENV === "development") {
        // Ctrl+Shift+I for DevTools
        globalShortcut.register("CommandOrControl+Shift+I", () => {
          if (mainWindow) {
            mainWindow.webContents.toggleDevTools();
          }
        });

        // Ctrl+R for reload
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

  // App before quit -- set flag so window close handler allows the close
  app.on("before-quit", () => {
    (app as unknown as Record<string, boolean>).isQuitting = true;
  });

  // App quit -- synchronous cleanup, matching old main.ts behavior
  app.on("quit", () => {
    try {
      // Unregister global shortcuts
      globalShortcut.unregisterAll();

      // Stop Go daemon only if kill_daemon_on_exit is enabled.
      // Use the cached config (synchronous) like the old code did.
      const config = windowManager?.cachedConfig;
      if (config?.app?.kill_daemon_on_exit) {
        goDaemonClient.shutdown().catch((error) => {
          logger.error({ err: error }, "Failed to stop daemon");
        });
      }

      // Cleanup managers
      if (themeManager) themeManager.cleanup();
      if (ipcManager) ipcManager.cleanup();
      if (daemonMonitor) daemonMonitor.cleanup();
    } catch (error) {
      logger.error({ err: error }, "Error during shutdown");
    }
  });

  // App second instance
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

/**
 * Setup development tools
 */
function setupDevTools(): void {
  if (process.env.NODE_ENV === "development") {
    // Enable live reload
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

/**
 * Main application entry point
 */
function main(): void {
  // Prevent multiple instances
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
    return;
  }

  // Setup development tools
  setupDevTools();

  // Setup application events
  setupAppEvents();
}

// Start the application
main();
