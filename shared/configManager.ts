import { promises as fs, type FSWatcher } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { parse, stringify } from "smol-toml";

interface AppConfig {
	kill_daemon_on_exit: boolean;
	notifications: boolean;
	start_minimized: boolean;
	minimize_instead_of_close: boolean;
	random_image_monitor: "clone" | "extend" | "individual";
	show_monitor_modal_on_start: boolean;
	images_per_page: number;
	theme: string;
	sidebar_collapsed: boolean;
	sort_by: "name" | "date" | "size";
	sort_order: "asc" | "desc";
}

interface DaemonConfig {
	database_path: string;
	images_dir: string;
	thumbnails_dir: string;
	monitors_state_file: string;
	socket_path: string;
	log_level: "debug" | "info" | "warn" | "error";
	log_file: string;
	log_max_size: number;
	log_max_age: number;
	log_max_backups: number;
	compositor: string;
}

interface SwwwConfig {
	transition_type: "simple" | "wipe" | "grow" | "outer" | "wave";
	transition_step: number;
	transition_duration: number;
	transition_angle: number;
	transition_pos: "center" | "top" | "bottom" | "left" | "right";
	transition_bezier: string;
	transition_wave: string;
}

interface BackendConfig {
	type: "swww" | "feh" | "nitrogen" | "custom";
	swww?: SwwwConfig;
}

interface MonitorsConfig {
	selected_monitors: string[];
	image_set_type: "individual" | "extend" | "clone";
}

interface ElectronConfig {
	log_level: "debug" | "info" | "warn" | "error";
	log_file: string;
	log_max_size: number;
	log_max_age: number;
	log_max_backups: number;
}

interface WaypaperConfig {
	app: AppConfig;
	daemon: DaemonConfig;
	electron: ElectronConfig;
	backend: BackendConfig;
	monitors: MonitorsConfig;
}

class ConfigManager {
	private configPath: string;
	private config: WaypaperConfig | null = null;
	private watchers: Set<(config: WaypaperConfig) => void> = new Set();
	private fileWatcher: FSWatcher | null = null;

	constructor(configPath?: string) {
		if (configPath) {
			this.configPath = configPath;
		} else {
			// Use XDG_CONFIG_HOME or fallback to ~/.config
			const configDir =
				process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
			this.configPath = join(configDir, "waypaper-engine", "config.toml");
		}
	}

	async loadConfig(): Promise<WaypaperConfig> {
		if (this.config) {
			return this.config;
		}

		try {
			// Ensure the config directory exists
			const configDir = dirname(this.configPath);
			await fs.mkdir(configDir, { recursive: true });

			// Try to read the config file
			const data = await fs.readFile(this.configPath, "utf-8");
			this.config = parse(data) as unknown as WaypaperConfig;

			// Expand tilde paths
			this.config = this.expandPaths(this.config);

			// Config loaded successfully - no need to log every time
		} catch (_error) {
			// If file doesn't exist or is invalid, use defaults
			// Using default config - this is normal on first run
			this.config = this.getDefaultConfig();
			await this.saveConfig();
		}

		return this.config as WaypaperConfig;
	}

	async saveConfig(): Promise<void> {
		if (!this.config) {
			// No config to save - this shouldn't happen
			return;
		}

		// Ensure the config directory exists
		const configDir = dirname(this.configPath);
		await fs.mkdir(configDir, { recursive: true });

		// Convert paths back to tilde notation for storage
		const configToSave = this.contractPaths(this.config);

		// Write the config file
		const tomlContent = stringify(configToSave);
		await fs.writeFile(this.configPath, tomlContent, "utf-8");
	}

	async updateConfig(updates: Partial<WaypaperConfig>): Promise<void> {
		const currentConfig = await this.loadConfig();
		this.config = this.deepMerge(currentConfig, updates) as WaypaperConfig;
		await this.saveConfig();

		// Notify watchers
		this.notifyWatchers();
	}

	async getConfig(): Promise<WaypaperConfig> {
		return await this.loadConfig();
	}

	// Watch for config file changes
	async startWatching(): Promise<void> {
		if (this.fileWatcher) {
			return; // Already watching
		}

		try {
			const { watch } = await import("node:fs");
			this.fileWatcher = watch(this.configPath, async (eventType) => {
				if (eventType === "change") {
					try {
						const data = await fs.readFile(this.configPath, "utf-8");
						this.config = this.expandPaths(
							parse(data) as unknown as WaypaperConfig,
						);
						this.notifyWatchers();
						// Config file changed and reloaded
					} catch (_error) {
						// Failed to reload config - will retry on next change
					}
				}
			});
			// Started watching config file
		} catch (_error) {
			// Failed to start watching - config changes won't be detected
		}
	}

	stopWatching(): void {
		if (this.fileWatcher) {
			this.fileWatcher.close();
			this.fileWatcher = null;
			// Stopped watching config file
		}
	}

	// Subscribe to config changes
	subscribe(callback: (config: WaypaperConfig) => void): () => void {
		this.watchers.add(callback);
		return () => {
			this.watchers.delete(callback);
		};
	}

	private notifyWatchers(): void {
		const config = this.config;
		if (config) {
			this.watchers.forEach((callback) => {
				try {
					callback(config);
				} catch (_error) {
					// Error in config watcher - continuing
				}
			});
		}
	}

	private expandPaths(config: WaypaperConfig): WaypaperConfig {
		const expandPath = (path: string): string => {
			if (path.startsWith("~/")) {
				return join(homedir(), path.slice(2));
			}
			return path;
		};

		return {
			...config,
			daemon: {
				...config.daemon,
				database_path: expandPath(config.daemon.database_path),
				images_dir: expandPath(config.daemon.images_dir),
				thumbnails_dir: expandPath(config.daemon.thumbnails_dir),
				monitors_state_file: expandPath(config.daemon.monitors_state_file),
			},
		};
	}

	private contractPaths(config: WaypaperConfig): WaypaperConfig {
		const contractPath = (path: string): string => {
			const home = homedir();
			if (path.startsWith(home)) {
				return `~${path.slice(home.length)}`;
			}
			return path;
		};

		return {
			...config,
			daemon: {
				...config.daemon,
				database_path: contractPath(config.daemon.database_path),
				images_dir: contractPath(config.daemon.images_dir),
				thumbnails_dir: contractPath(config.daemon.thumbnails_dir),
				monitors_state_file: contractPath(config.daemon.monitors_state_file),
			},
		};
	}

	private deepMerge(target: unknown, source: unknown): unknown {
		if (
			!target ||
			typeof target !== "object" ||
			!source ||
			typeof source !== "object"
		) {
			return source;
		}

		const result = { ...(target as Record<string, unknown>) };
		const sourceObj = source as Record<string, unknown>;

		for (const key in sourceObj) {
			if (
				sourceObj[key] &&
				typeof sourceObj[key] === "object" &&
				!Array.isArray(sourceObj[key])
			) {
				result[key] = this.deepMerge(result[key] || {}, sourceObj[key]);
			} else {
				result[key] = sourceObj[key];
			}
		}

		return result;
	}

	private getDefaultConfig(): WaypaperConfig {
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
			},
			daemon: {
				database_path: "~/.waypaper-engine/data",
				images_dir: "~/.waypaper-engine/images",
				thumbnails_dir: "~/.waypaper-engine/data/cache/thumbnails",
				monitors_state_file: "~/.cache/waypaper-engine/monitors.json",
				socket_path: "/tmp/waypaper-engine.sock",
				log_level: "info",
				log_file: "~/.config/waypaper-engine/daemon.log",
				log_max_size: 10,
				log_max_age: 7,
				log_max_backups: 3,
				compositor: "auto",
			},
			electron: {
				log_level: "info",
				log_file: "~/.config/waypaper-engine/electron.log",
				log_max_size: 10,
				log_max_age: 7,
				log_max_backups: 3,
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

	getElectronConfig(): ElectronConfig {
		return (
			this.config?.electron || {
				log_level: "info",
				log_file: "~/.config/waypaper-engine/electron.log",
				log_max_size: 10,
				log_max_age: 7,
				log_max_backups: 3,
			}
		);
	}

	getElectronLogLevel(): string {
		return this.getElectronConfig().log_level;
	}

	getElectronLogFile(): string {
		const electronConfig = this.getElectronConfig();
		if (electronConfig.log_file.startsWith("~/")) {
			return join(homedir(), electronConfig.log_file.slice(2));
		}
		return electronConfig.log_file;
	}
}

// Export a singleton instance
export const configManager = new ConfigManager();
