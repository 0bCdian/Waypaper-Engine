import { readFileSync, existsSync, watch, FSWatcher } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { homedir, tmpdir } from "node:os";
import toml from "toml";
import { EventEmitter } from "node:events";
import type {
  AppConfig,
  DaemonConfig,
  BackendSection,
  MonitorsConfig,
  WallhavenConfig,
} from "../electron/daemon-go-types";

/**
 * Returns the default socket path matching the Go daemon's XDG logic:
 * $XDG_RUNTIME_DIR/waypaper-engine.sock
 * Falls back to /tmp/waypaper-engine-<uid>.sock if XDG_RUNTIME_DIR is unset.
 */
function defaultSocketPath(): string {
  const runtimeDir = process.env.XDG_RUNTIME_DIR;
  if (runtimeDir) {
    return join(runtimeDir, "waypaper-engine.sock");
  }
  return join(tmpdir(), `waypaper-engine-${process.getuid?.() ?? 0}.sock`);
}

export interface ElectronConfig {
  log_level: "debug" | "info" | "warn" | "error";
  log_file: string;
  log_max_size_mb: number;
  log_max_backups: number;
}

/**
 * Extends the daemon's UnifiedConfig with the optional electron section,
 * and makes wallhaven optional since the TOML may omit it at startup.
 */
export interface WaypaperConfig {
  app: AppConfig;
  daemon: DaemonConfig;
  electron?: ElectronConfig;
  backend: BackendSection;
  monitors: MonitorsConfig;
  wallhaven?: WallhavenConfig;
}

export class ConfigReader extends EventEmitter {
  private config: WaypaperConfig | null = null;
  private configPath: string;
  private fileWatcher: FSWatcher | null = null;
  private isWatching: boolean = false;

  constructor(configPath?: string) {
    super();

    if (process.env.WAYPAPER_CONFIG) {
      this.configPath = process.env.WAYPAPER_CONFIG;
    } else if (configPath) {
      this.configPath = configPath;
    } else {
      const homeDir = homedir();
      const devEnv = process.env.DEV === "true";

      if (devEnv) {
        this.configPath = "/tmp/waypaper-engine/config.toml";
      } else {
        this.configPath = join(homeDir, ".config", "waypaper-engine", "config.toml");
      }
    }
  }

  loadConfig(): WaypaperConfig {
    if (this.config) {
      return this.config;
    }

    try {
      if (!existsSync(this.configPath)) {
        this.config = this.getDefaultConfig();
        return this.config;
      }
      const configContent = readFileSync(this.configPath, "utf-8");
      this.config = toml.parse(configContent) as WaypaperConfig;
      this.config = this.expandPaths(this.config);
      return this.config;
    } catch (error) {
      console.error("Failed to load config, using default configuration", {
        err: error instanceof Error ? error.message : String(error),
        configPath: this.configPath,
      });
      this.config = this.getDefaultConfig();
      return this.config;
    }
  }

  private expandPaths(config: WaypaperConfig): WaypaperConfig {
    const homeDir = homedir();

    return {
      ...config,
      daemon: {
        ...config.daemon,
        database_dir: this.expandPath(config.daemon.database_dir, homeDir),
        images_dir: this.expandPath(config.daemon.images_dir, homeDir),
        thumbnails_dir: this.expandPath(config.daemon.thumbnails_dir, homeDir),
        socket_path: this.expandPath(config.daemon.socket_path, homeDir),
      },
    };
  }

  private expandPath(path: string, homeDir: string): string {
    if (path.startsWith("~/")) {
      return join(homeDir, path.slice(2));
    }
    return path;
  }

  private getDefaultConfig(): WaypaperConfig {
    const homeDir = homedir();
    const dataDir = join(homeDir, ".local", "share", "waypaper-engine");
    const cacheDir = join(homeDir, ".cache", "waypaper-engine");

    return {
      app: {
        kill_daemon_on_exit: false,
        notifications: true,
        start_minimized: false,
        minimize_instead_of_close: false,
        show_monitor_modal_on_start: false,
        images_per_page: 50,
        theme: "dark",
        image_history_limit: 100,
        sort_by: "imported_at",
        sort_order: "desc",
      },
      daemon: {
        images_dir: join(dataDir, "images"),
        thumbnails_dir: join(cacheDir, "thumbnails"),
        database_dir: join(dataDir, "db"),
        socket_path: defaultSocketPath(),
        log_level: "info",
        log_file: join(dataDir, "daemon.log"),
        log_max_size_mb: 10,
        log_max_backups: 3,
        compositor: "auto",
      },
      backend: {
        type: "awww",
        awww: {
          transition_type: "wipe",
          transition_step: 90,
          transition_duration: 3,
          transition_fps: 60,
          transition_angle: 45,
          transition_pos: "center",
          transition_bezier: "0.25,0.1,0.25,1.0",
          transition_wave: "20,20",
          resize: "crop",
          fill_color: "000000",
          filter_type: "Lanczos3",
          invert_y: false,
        },
      },
      monitors: {
        selected_monitors: [],
        image_set_type: "individual",
      },
    };
  }

  getDaemonPath(): string {
    const isPackaged = !(process.env.NODE_ENV === "development");
    const bundledCandidates = isPackaged
      ? [
          // Preferred packaged location (works for AppImage and unpacked installs)
          join(process.resourcesPath, "waypaper-daemon"),
          // Legacy fallback for older layouts
          join(process.resourcesPath, "app", "waypaper-daemon"),
          join(__dirname, "..", "..", "waypaper-daemon"),
        ]
      : [join(process.cwd(), "daemon", "build", "waypaper-daemon")];

    for (const candidate of bundledCandidates) {
      if (existsSync(candidate)) return candidate;
    }

    if (isPackaged) {
      // Packaged builds must use the bundled daemon to avoid version drift.
      return bundledCandidates[0];
    }

    // Fall back to system-installed binary (e.g. /usr/bin/waypaper-daemon)
    try {
      const systemPath = execSync("which waypaper-daemon", {
        encoding: "utf-8",
      }).trim();
      if (systemPath && existsSync(systemPath)) return systemPath;
    } catch {
      // which failed -- binary not in PATH
    }

    // Return primary bundled candidate so spawn fails with a clear error
    return bundledCandidates[0];
  }

  getSocketPath(): string {
    if (process.env.WAYPAPER_SOCKET) return process.env.WAYPAPER_SOCKET;
    const config = this.loadConfig();
    return config.daemon.socket_path;
  }

  getImagesDir(): string {
    const config = this.loadConfig();
    return config.daemon.images_dir;
  }

  getThumbnailsDir(): string {
    const config = this.loadConfig();
    return config.daemon.thumbnails_dir;
  }

  getDatabaseDir(): string {
    const config = this.loadConfig();
    return config.daemon.database_dir;
  }

  getElectronConfig(): ElectronConfig {
    const config = this.loadConfig();
    return (
      config.electron ?? {
        log_level: "info",
        log_file: join(homedir(), ".local", "share", "waypaper-engine", "electron.log"),
        log_max_size_mb: 10,
        log_max_backups: 3,
      }
    );
  }

  getElectronLogFile(): string {
    const electronConfig = this.getElectronConfig();
    if (electronConfig.log_file.startsWith("~/")) {
      return join(homedir(), electronConfig.log_file.slice(2));
    }
    return electronConfig.log_file;
  }

  // File watching methods
  startWatching(): void {
    if (this.isWatching) {
      return;
    }

    try {
      this.fileWatcher = watch(this.configPath, (eventType) => {
        if (eventType === "change") {
          this.reloadConfig();
        }
      });

      this.isWatching = true;
    } catch (error) {
      console.error("Failed to start watching config file", {
        err: error instanceof Error ? error.message : String(error),
        configPath: this.configPath,
      });
    }
  }

  stopWatching(): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
      this.isWatching = false;
    }
  }

  private reloadConfig(): void {
    try {
      this.config = null;
      const newConfig = this.loadConfig();
      this.emit("configChanged", newConfig);
    } catch (error) {
      console.error("Failed to reload configuration", {
        err: error instanceof Error ? error.message : String(error),
        configPath: this.configPath,
      });
    }
  }

  getCurrentConfig(): WaypaperConfig {
    return this.loadConfig();
  }
}

export const configReader = new ConfigReader();
