import { BrowserWindow, app } from "electron";
import { join } from "node:path";
import { goDaemonClient } from "../goDaemonClient";
import type { UnifiedConfig } from "../daemon-go-types";
import { logger } from "../logger";

export class WindowManager {
  cachedConfig: UnifiedConfig | null = null;
  private isInitialWindow = true;

  constructor() {
    goDaemonClient.on("config_changed", () => void this.loadConfig());
  }

  /** Must be awaited before createWindow so start_minimized is honoured. */
  async loadConfig(): Promise<void> {
    try {
      this.cachedConfig = await goDaemonClient.control.getConfig();
    } catch (error) {
      logger.warn({ err: error }, "WindowManager: failed to load config");
    }
  }

  createWindow(): BrowserWindow {
    const window = new BrowserWindow({
      width: 1200,
      height: 1000,
      minWidth: 350,
      minHeight: 400,
      show: false,
      frame: false,
      titleBarStyle: "hidden",
      backgroundColor: "#323232",
      icon: join(__dirname, "../build/icons/512x512.png"),
      webPreferences: {
        preload: join(__dirname, "preload.js"),
        sandbox: false,
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    window.on("close", (event) => {
      if ((app as unknown as Record<string, boolean>).isQuitting) return;
      if (this.cachedConfig?.app?.minimize_instead_of_close) {
        event.preventDefault();
        window.hide();
      }
    });

    window.once("ready-to-show", () => {
      if (this.isInitialWindow && this.cachedConfig?.app?.start_minimized) {
        window.hide();
      } else {
        window.show();
      }
      this.isInitialWindow = false;
    });

    return window;
  }
}
