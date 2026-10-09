import { BrowserWindow, app } from "electron";
import { join } from "node:path";
import { configReader } from "../../globals/configReader";
import { goDaemonClient } from "../goDaemonClient";
import type { AppConfig } from "../daemon-go-types";
import { logger } from "../logger";

export class WindowManager {
  /** Seeded from config.toml so the window never waits on the daemon; kept fresh by config_changed. */
  appConfig: Partial<AppConfig> = configReader.loadConfig().app ?? {};
  private isInitialWindow = true;

  constructor() {
    goDaemonClient.on("config_changed", () => void this.loadConfig());
  }

  async loadConfig(): Promise<void> {
    try {
      this.appConfig = (await goDaemonClient.control.getConfig()).app;
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
      if (this.appConfig.minimize_instead_of_close) {
        event.preventDefault();
        window.hide();
      }
    });

    window.once("ready-to-show", () => {
      if (this.isInitialWindow && this.appConfig.start_minimized) {
        window.hide();
      } else {
        window.show();
      }
      this.isInitialWindow = false;
    });

    return window;
  }
}
