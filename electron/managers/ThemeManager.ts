/**
 * Theme Manager for Electron Main Process
 *
 * Handles theme synchronization between Electron and the renderer process.
 */

import { nativeTheme, ipcMain, BrowserWindow } from "electron";

export class ThemeManager {
	private windows: Set<BrowserWindow> = new Set();
	private isInitialized = false;

	/**
	 * Initialize the theme manager
	 */
	initialize(): void {
		if (this.isInitialized) return;

		this.setupNativeThemeHandling();
		this.setupIPC();
		this.isInitialized = true;

		("Theme Manager initialized");
	}

	/**
	 * Register a window for theme updates
	 */
	registerWindow(window: BrowserWindow): void {
		this.windows.add(window);

		// Send current theme to the new window
		this.sendThemeUpdate(window);
	}

	/**
	 * Unregister a window
	 */
	unregisterWindow(window: BrowserWindow): void {
		this.windows.delete(window);
	}

	/**
	 * Setup native theme handling
	 */
	private setupNativeThemeHandling(): void {
		nativeTheme.on("updated", () => {
			this.broadcastThemeUpdate();
		});
	}

	/**
	 * Setup IPC handlers
	 * Note: IPC handlers are now managed by IPCManager
	 */
	private setupIPC(): void {
		// Listen for theme changes from renderer
		ipcMain.on("theme-changed", (_, themeName: string) => {
			`Theme changed to: ${themeName}`;
			// Could sync with system theme if needed
		});
	}

	/**
	 * Send theme update to a specific window
	 */
	private sendThemeUpdate(window: BrowserWindow): void {
		if (window.isDestroyed()) return;

		const themeInfo = {
			shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
			shouldUseHighContrastColors: nativeTheme.shouldUseHighContrastColors,
			shouldUseInvertedColorScheme: nativeTheme.shouldUseInvertedColorScheme,
			themeSource: nativeTheme.themeSource,
			timestamp: Date.now(),
		};

		window.webContents.send("native-theme-updated", themeInfo);
	}

	/**
	 * Broadcast theme update to all registered windows
	 */
	private broadcastThemeUpdate(): void {
		this.windows.forEach((window) => {
			this.sendThemeUpdate(window);
		});
	}

	/**
	 * Get current native theme info
	 */
	getNativeThemeInfo() {
		return {
			shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
			shouldUseHighContrastColors: nativeTheme.shouldUseHighContrastColors,
			shouldUseInvertedColorScheme: nativeTheme.shouldUseInvertedColorScheme,
			themeSource: nativeTheme.themeSource,
		};
	}

	/**
	 * Set theme source
	 */
	setThemeSource(source: "system" | "light" | "dark"): void {
		nativeTheme.themeSource = source;
		this.broadcastThemeUpdate();
	}

	/**
	 * Cleanup
	 */
	cleanup(): void {
		this.windows.clear();
		this.isInitialized = false;
		("Theme Manager cleaned up");
	}
}

export default ThemeManager;
