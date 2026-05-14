/**
 * Window Manager for Electron Main Process
 *
 * Handles window creation, management, and lifecycle.
 */

import { BrowserWindow, app, screen } from "electron";
import { join } from "node:path";
import type { ThemeManager } from "./ThemeManager";
import { goDaemonClient } from "../goDaemonClient";
import type { UnifiedConfig } from "../daemon-go-types";
import { logger } from "../logger";

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
  cachedConfig: UnifiedConfig | null = null;
  private isInitialWindow = true;

  constructor(themeManager: ThemeManager) {
    this.themeManager = themeManager;
    this.defaultConfig = {
      width: 1200,
      height: 1000,
      minWidth: 350,
      minHeight: 400,
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
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        experimentalFeatures: false,
      },
    };
  }

  /**
   * Load config from Go daemon. Must be called (and awaited) before createWindow.
   */
  async loadConfig(): Promise<void> {
    try {
      this.cachedConfig = await goDaemonClient.getConfig();
    } catch (error) {
      logger.warn({ err: error }, "WindowManager: failed to load config");
    }
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

    logger.info({ windowId: id }, "Window created");
    return window;
  }

  /**
   * Setup window event handlers
   */
  private setupWindowEvents(id: string, window: BrowserWindow): void {
    // Intercept close to hide instead (like the old code: minimize-to-tray)
    window.on("close", (event) => {
      if ((app as unknown as Record<string, boolean>).isQuitting) return;
      if (this.cachedConfig?.app?.minimize_instead_of_close) {
        event.preventDefault();
        window.hide();
      }
    });

    // Window closed
    window.on("closed", () => {
      this.windows.delete(id);
      this.themeManager.unregisterWindow(window);
      logger.info({ windowId: id }, "Window closed");
    });

    // Window ready to show
    window.once("ready-to-show", () => {
      if (this.isInitialWindow && this.cachedConfig?.app?.start_minimized) {
        window.hide();
      } else {
        window.show();
      }
      this.isInitialWindow = false;
      logger.info({ windowId: id }, "Window ready");
    });
  }
}
