import { readFileSync, existsSync, watch, FSWatcher } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import toml from "toml";
import { EventEmitter } from "node:events";
import { logger } from "./setup";

export interface AppConfig {
    kill_daemon_on_exit: boolean;
    notifications: boolean;
    start_minimized: boolean;
    minimize_instead_of_close: boolean;
    random_image_monitor: string;
    show_monitor_modal_on_start: boolean;
    images_per_page: number;
    theme: string;
    sidebar_collapsed: boolean;
    sort_by: string;
    sort_order: string;
    image_history_limit: number;
}

export interface DaemonConfig {
    database_path: string;
    images_dir: string;
    thumbnails_dir: string;
    monitors_state_file: string;
    socket_path: string;
    log_level: string;
    log_file: string;
    log_max_size: number;
    log_max_age: number;
    log_max_backups: number;
    compositor: string;
    daemon_path?: string;
}

export interface SwwwConfig {
    transition_type: string;
    transition_step: number;
    transition_duration: number;
    transition_angle: number;
    transition_pos: string;
    transition_bezier: string;
    transition_wave: string;
}

export interface BackendConfig {
    type: string;
    swww: SwwwConfig;
}

export interface MonitorsConfig {
    selected_monitors: string[];
    image_set_type: string;
}

export interface WaypaperConfig {
    app: AppConfig;
    daemon: DaemonConfig;
    backend: BackendConfig;
    monitors: MonitorsConfig;
}

export class ConfigReader extends EventEmitter {
    private config: WaypaperConfig | null = null;
    private configPath: string;
    private fileWatcher: FSWatcher | null = null;
    private isWatching: boolean = false;

    constructor(configPath?: string) {
        super();
        
        if (configPath) {
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
            logger.error("Failed to load config, using default configuration", { 
                error: error instanceof Error ? error.message : String(error),
                configPath: this.configPath 
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
                database_path: this.expandPath(config.daemon.database_path, homeDir),
                images_dir: this.expandPath(config.daemon.images_dir, homeDir),
                thumbnails_dir: this.expandPath(config.daemon.thumbnails_dir, homeDir),
                monitors_state_file: this.expandPath(config.daemon.monitors_state_file, homeDir),
                socket_path: config.daemon.socket_path
            }
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
        const devEnv = process.env.DEV === "true";
        const baseDir = devEnv ? "/tmp/waypaper-engine" : homeDir;

        return {
            app: {
                kill_daemon_on_exit: true,
                notifications: true,
                start_minimized: false,
                minimize_instead_of_close: true,
                random_image_monitor: "individual",
                show_monitor_modal_on_start: false,
                images_per_page: 20,
                theme: "dark",
                sidebar_collapsed: false,
                sort_by: "name",
                sort_order: "asc",
                image_history_limit: 50,
            },
            daemon: {
                database_path: join(baseDir, ".waypaper-engine", "data"),
                images_dir: join(baseDir, ".waypaper-engine", "images"),
                thumbnails_dir: join(baseDir, ".waypaper-engine", "data", "cache", "thumbnails"),
                monitors_state_file: join(baseDir, ".cache", "waypaper-engine", "monitors.json"),
                socket_path: "/tmp/waypaper-engine.sock",
                log_level: "info",
                log_file: "",
                log_max_size: 10,
                log_max_age: 7,
                log_max_backups: 3,
                compositor: "auto",
            },
            backend: {
                type: "swww",
                swww: {
                    transition_type: "simple",
                    transition_step: 90,
                    transition_duration: 200,
                    transition_angle: 45,
                    transition_pos: "center",
                    transition_bezier: "0.4,0.0,0.2,1",
                    transition_wave: "0,0,0,0",
                },
            },
            monitors: {
                selected_monitors: [],
                image_set_type: "individual",
            },
        };
    }

    getDaemonPath(): string {
        const config = this.loadConfig();
        
        if (config.daemon.daemon_path) {
            return config.daemon.daemon_path;
        }
        
        const isPackaged = !(process.env.NODE_ENV === "development");
        const resourcesPath = join(__dirname, "..", "..");
        
        return isPackaged
            ? join(resourcesPath, "waypaper-daemon")
            : join(process.cwd(), "daemon-go", "waypaper-daemon");
    }

    getSocketPath(): string {
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

    getDatabasePath(): string {
        const config = this.loadConfig();
        return config.daemon.database_path;
    }

    getMonitorsStateFile(): string {
        const config = this.loadConfig();
        return config.daemon.monitors_state_file;
    }

    // File watching methods
    startWatching(): void {
        if (this.isWatching) {
            return;
        }

        try {
            this.fileWatcher = watch(this.configPath, (eventType) => {
                if (eventType === 'change') {
                    this.reloadConfig();
                }
            });
            
            this.isWatching = true;
        } catch (error) {
            logger.error("Failed to start watching config file", { 
                error: error instanceof Error ? error.message : String(error),
                configPath: this.configPath 
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
            this.emit('configChanged', newConfig);
        } catch (error) {
            logger.error("Failed to reload configuration", { 
                error: error instanceof Error ? error.message : String(error),
                configPath: this.configPath 
            });
        }
    }

    getCurrentConfig(): WaypaperConfig {
        return this.loadConfig();
    }
}

export const configReader = new ConfigReader();
