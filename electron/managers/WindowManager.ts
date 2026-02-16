/**
 * Window Manager for Electron Main Process
 *
 * Handles window creation, management, and lifecycle.
 */

import { BrowserWindow, screen } from "electron";
import { join } from "node:path";
import type { ThemeManager } from "./ThemeManager";

export interface WindowConfig {
	width?: number;
	height?: number;
	minWidth?: number;
	minHeight?: number;
	maxWidth?: number;
	maxHeight?: number;
	resizable?: boolean;
	minimizable?: boolean;
	maximizable?: boolean;
	closable?: boolean;
	alwaysOnTop?: boolean;
	fullscreenable?: boolean;
	skipTaskbar?: boolean;
	show?: boolean;
	frame?: boolean;
	titleBarStyle?: "default" | "hidden" | "hiddenInset" | "customButtonsOnHover";
	backgroundColor?: string;
	webPreferences?: Electron.WebPreferences;
}

export class WindowManager {
	private windows: Map<string, BrowserWindow> = new Map();
	private themeManager: ThemeManager;
	private defaultConfig: WindowConfig;

	constructor(themeManager: ThemeManager) {
		this.themeManager = themeManager;
		this.defaultConfig = {
			width: 1200,
			height: 1000,
			minWidth: 800,
			minHeight: 600,
			resizable: true,
			minimizable: true,
			maximizable: true,
			closable: true,
			alwaysOnTop: false,
			fullscreenable: true,
			skipTaskbar: false,
			show: false,
			frame: true,
			titleBarStyle: "default",
			backgroundColor: "#1f2937", // Default dark background
			webPreferences: {
				preload: join(__dirname, "preload.js"),
				sandbox: false,
				nodeIntegration: true,
				contextIsolation: false,
				webSecurity: true,
				allowRunningInsecureContent: false,
				experimentalFeatures: false,
			},
		};
	}

	/**
	 * Create a new window
	 */
	createWindow(id: string, config: Partial<WindowConfig> = {}): BrowserWindow {
		// Merge with default config
		const windowConfig = { ...this.defaultConfig, ...config };

		// Get display info
		const { width, height } = screen.getPrimaryDisplay().workAreaSize;

		// Center the window
		const x = Math.round((width - (windowConfig.width ?? 1200)) / 2);
		const y = Math.round((height - (windowConfig.height ?? 1000)) / 2);

		const window = new BrowserWindow({
			...windowConfig,
			x,
			y,
			icon: join(__dirname, "../build/icons/512x512.png"),
		});

		// Register with theme manager
		this.themeManager.registerWindow(window);

		// Store window reference
		this.windows.set(id, window);

		// Setup window event handlers
		this.setupWindowEvents(id, window);

		console.log(`Window created: ${id}`);
		return window;
	}

	/**
	 * Get a window by ID
	 */
	getWindow(id: string): BrowserWindow | undefined {
		return this.windows.get(id);
	}

	/**
	 * Get all windows
	 */
	getAllWindows(): BrowserWindow[] {
		return Array.from(this.windows.values());
	}

	/**
	 * Close a window
	 */
	closeWindow(id: string): boolean {
		const window = this.windows.get(id);
		if (!window) return false;

		window.close();
		return true;
	}

	/**
	 * Close all windows
	 */
	closeAllWindows(): void {
		this.windows.forEach((window, _id) => {
			if (!window.isDestroyed()) {
				window.close();
			}
		});
	}

	/**
	 * Minimize a window
	 */
	minimizeWindow(id: string): boolean {
		const window = this.windows.get(id);
		if (!window || window.isDestroyed()) return false;

		window.minimize();
		return true;
	}

	/**
	 * Maximize a window
	 */
	maximizeWindow(id: string): boolean {
		const window = this.windows.get(id);
		if (!window || window.isDestroyed()) return false;

		if (window.isMaximized()) {
			window.unmaximize();
		} else {
			window.maximize();
		}
		return true;
	}

	/**
	 * Show a window
	 */
	showWindow(id: string): boolean {
		const window = this.windows.get(id);
		if (!window || window.isDestroyed()) return false;

		window.show();
		window.focus();
		return true;
	}

	/**
	 * Hide a window
	 */
	hideWindow(id: string): boolean {
		const window = this.windows.get(id);
		if (!window || window.isDestroyed()) return false;

		window.hide();
		return true;
	}

	/**
	 * Set window bounds
	 */
	setWindowBounds(id: string, bounds: Electron.Rectangle): boolean {
		const window = this.windows.get(id);
		if (!window || window.isDestroyed()) return false;

		window.setBounds(bounds);
		return true;
	}

	/**
	 * Get window bounds
	 */
	getWindowBounds(id: string): Electron.Rectangle | null {
		const window = this.windows.get(id);
		if (!window || window.isDestroyed()) return null;

		return window.getBounds();
	}

	/**
	 * Set window title
	 */
	setWindowTitle(id: string, title: string): boolean {
		const window = this.windows.get(id);
		if (!window || window.isDestroyed()) return false;

		window.setTitle(title);
		return true;
	}

	/**
	 * Set window always on top
	 */
	setAlwaysOnTop(id: string, alwaysOnTop: boolean): boolean {
		const window = this.windows.get(id);
		if (!window || window.isDestroyed()) return false;

		window.setAlwaysOnTop(alwaysOnTop);
		return true;
	}

	/**
	 * Setup window event handlers
	 */
	private setupWindowEvents(id: string, window: BrowserWindow): void {
		// Window closed
		window.on("closed", () => {
			this.windows.delete(id);
			this.themeManager.unregisterWindow(window);
			console.log(`Window closed: ${id}`);
		});

		// Window ready to show
		window.once("ready-to-show", () => {
			window.show();
			console.log(`Window ready: ${id}`);
		});

		// Window focus
		window.on("focus", () => {
			console.log(`Window focused: ${id}`);
		});

		// Window blur
		window.on("blur", () => {
			console.log(`Window blurred: ${id}`);
		});

		// Window maximize
		window.on("maximize", () => {
			console.log(`Window maximized: ${id}`);
		});

		// Window unmaximize
		window.on("unmaximize", () => {
			console.log(`Window unmaximized: ${id}`);
		});

		// Window minimize
		window.on("minimize", () => {
			console.log(`Window minimized: ${id}`);
		});

		// Window restore
		window.on("restore", () => {
			console.log(`Window restored: ${id}`);
		});

		// Window resize
		window.on("resize", () => {
			const bounds = window.getBounds();
			console.log(`Window resized: ${id}`, bounds);
		});

		// Window move
		window.on("move", () => {
			const bounds = window.getBounds();
			console.log(`Window moved: ${id}`, bounds);
		});
	}

	/**
	 * Get window count
	 */
	getWindowCount(): number {
		return this.windows.size;
	}

	/**
	 * Check if window exists
	 */
	hasWindow(id: string): boolean {
		return this.windows.has(id);
	}

	/**
	 * Get window IDs
	 */
	getWindowIds(): string[] {
		return Array.from(this.windows.keys());
	}

	/**
	 * Cleanup all windows
	 */
	cleanup(): void {
		this.closeAllWindows();
		this.windows.clear();
		("Window Manager cleaned up");
	}
}

export default WindowManager;
