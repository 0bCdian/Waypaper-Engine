import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { app, BrowserWindow, globalShortcut, Menu, protocol } from "electron";

// Daemon initialization
import { initWaypaperDaemon } from "../globals/startDaemons";

// Go daemon client
import { goDaemonClient } from "./goDaemonClient";

// Managers
import { daemonMonitor } from "./managers/DaemonMonitor";
import IPCManager from "./managers/IPCManager";
import ThemeManager from "./managers/ThemeManager";
import WindowManager from "./managers/WindowManager";

// Global variables
let mainWindow: BrowserWindow | null = null;
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
function createMainWindow(): void {
	// Create window manager
	windowManager = new WindowManager(themeManager);

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
		mainWindow.loadFile(join(__dirname, "../index.html"));
	}

	// Register with managers
	ipcManager.registerWindow(mainWindow);
	daemonMonitor.registerWindow(mainWindow);
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
			console.log("Continuing without daemon functionality");
		}

		("Application initialized successfully");
	} catch (error) {
		console.error("Failed to initialize application:", error);
		throw error;
	}
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
			createMainWindow();
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

	// App before quit
	app.on("before-quit", async () => {
		try {
			("Shutting down application...");

			// Unregister global shortcuts
			globalShortcut.unregisterAll();

			// Stop Go daemon (only if connected)
			try {
				await goDaemonClient.stopDaemon();
			} catch (error) {
				console.error("Go daemon was not connected, skipping stop", error);
			}

			// Cleanup managers
			if (themeManager) themeManager.cleanup();
			if (windowManager) windowManager.cleanup();
			if (ipcManager) ipcManager.cleanup();

			("Application shutdown complete");
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
	// Uncaught exceptions
	process.on("uncaughtException", (error) => {
		console.error("Uncaught Exception:", error);
		// Could show error dialog or send to crash reporting service
	});

	// Unhandled promise rejections
	process.on("unhandledRejection", (reason, _promise) => {
		console.error("Unhandled Rejection:", reason);
		// Could show error dialog or send to crash reporting service
	});

	// Electron crash reporter
	if (process.env.NODE_ENV === "production") {
		const { crashReporter } = require("electron");
		crashReporter.start({
			productName: APP_CONFIG.name,
			companyName: "Waypaper Engine",
			submitURL: "", // Add crash reporting URL if needed
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
