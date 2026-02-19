import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
	Tray,
	app,
	BrowserWindow,
	globalShortcut,
	Menu,
	nativeImage,
	protocol,
	Notification,
} from "electron";

// Daemon initialization
import { initWaypaperDaemon } from "../globals/startDaemons";

// Go daemon client
import { goDaemonClient } from "./goDaemonClient";

// Menus
import { trayMenu } from "../globals/menus";

// Managers
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
		("Initializing Waypaper Engine...");

		// Initialize theme manager
		themeManager = new ThemeManager();
		themeManager.initialize();

		// Initialize IPC manager
		ipcManager = new IPCManager();
		ipcManager.initialize();

		// Register custom atom:// protocol for file access
		protocol.registerFileProtocol("atom", (request, callback) => {
			const url = request.url;
			// Remove the atom:// prefix and convert back to file path
			const filePath = url.replace("atom://", "/");

			// Check if file exists and is accessible
			readFile(filePath)
				.then(() => {
					callback({ path: filePath });
				})
				.catch((error) => {
					console.error("Failed to access file:", filePath, error);
					callback({ error: -6 }); // ERR_FILE_NOT_FOUND
				});
		});

		// Initialize daemon monitor
		daemonMonitor.startMonitoring(5000); // Check every 5 seconds instead of 1 second

		// Initialize and start the daemon
		try {
			console.log("Initializing waypaper daemon...");
			await initWaypaperDaemon();
			console.log("Daemon initialized successfully");

			// Connect to the daemon
			await goDaemonClient.connect();
			console.log("Connected to daemon successfully");
		} catch (error) {
			console.error("Failed to initialize daemon:", error);
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
			console.log("Tray icon created");

			// Refresh tray menu when wallpaper changes
			goDaemonClient.on("wallpaper_changed", () => {
				void createAppTray();
			});

			// Native desktop notifications when window is hidden
			setupNativeNotifications();
		} catch (error) {
			console.error("Failed to create tray icon:", error);
		}

		("Application initialized successfully");
	} catch (error) {
		console.error("Failed to initialize application:", error);
		throw error;
	}
}

/**
 * Send native desktop notifications for daemon events when the window is hidden.
 * In-app toasts handle visible-window notifications on the renderer side.
 */
function setupNativeNotifications(): void {
	goDaemonClient.on("wallpaper_changed", (data: Record<string, unknown>) => {
		if (mainWindow?.isVisible()) return;
		const config = windowManager?.cachedConfig;
		if (!config?.app?.notifications) return;
		new Notification({
			title: "Wallpaper Changed",
			body: `Wallpaper set on ${Array.isArray(data?.monitors) ? (data.monitors as string[]).join(", ") : "monitor"}`,
		}).show();
	});

	goDaemonClient.on("playlist_started", (data: Record<string, unknown>) => {
		if (mainWindow?.isVisible()) return;
		const config = windowManager?.cachedConfig;
		if (!config?.app?.notifications) return;
		new Notification({
			title: "Playlist Started",
			body: `Playlist "${String(data?.name ?? "")}" started`,
		}).show();
	});

	goDaemonClient.on("playlist_stopped", (data: Record<string, unknown>) => {
		if (mainWindow?.isVisible()) return;
		const config = windowManager?.cachedConfig;
		if (!config?.app?.notifications) return;
		new Notification({
			title: "Playlist Stopped",
			body: `Playlist "${String(data?.name ?? "")}" stopped`,
		}).show();
	});

	goDaemonClient.on("processing_complete", () => {
		if (mainWindow?.isVisible()) return;
		const config = windowManager?.cachedConfig;
		if (!config?.app?.notifications) return;
		new Notification({
			title: "Processing Complete",
			body: "Image processing finished",
		}).show();
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
					("Menu bar hidden");
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
					("Menu bar shown (development mode)");
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
			console.error("Failed to start application:", error);
			app.quit();
		}
	});

	// App window all closed
	app.on("window-all-closed", () => {
		if (process.platform !== "darwin") {
			app.quit();
		}
	});

	// App activate (macOS)
	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createMainWindow();
		}
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
				goDaemonClient.stopDaemon().catch((error) => {
					console.error("Failed to stop daemon:", error);
				});
			}

			// Cleanup managers
			if (themeManager) themeManager.cleanup();
			if (ipcManager) ipcManager.cleanup();
		} catch (error) {
			console.error("Error during shutdown:", error);
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
 * Setup global error handling
 */
function setupErrorHandling(): void {
	if (process.env.NODE_ENV === "production") {
		const { crashReporter } = require("electron");
		crashReporter.start({
			productName: APP_CONFIG.name,
			companyName: "Waypaper Engine",
			submitURL: "",
			uploadToServer: false,
		});
	}
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
			console.warn(
				"Live reload not available:",
				error instanceof Error ? error.message : String(error),
			);
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

	// Setup error handling
	setupErrorHandling();

	// Setup development tools
	setupDevTools();

	// Setup application events
	setupAppEvents();

	`${APP_CONFIG.name} v${APP_CONFIG.version} starting...`;
}

// Start the application
main();
