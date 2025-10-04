import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import toml from '@iarna/toml';

export interface AppConfig {
    kill_daemon_on_exit: boolean;
    notifications: boolean;
    start_minimized: boolean;
    minimize_instead_of_close: boolean;
    random_image_monitor: 'clone' | 'extend' | 'individual';
    show_monitor_modal_on_start: boolean;
    images_per_page: number;
    theme: string;
    sidebar_collapsed: boolean;
    sort_by: 'name' | 'date' | 'size';
    sort_order: 'asc' | 'desc';
}

export interface DaemonConfig {
    database_path: string;
    images_dir: string;
    thumbnails_dir: string;
    monitors_state_file: string;
    socket_path: string;
    log_level: 'debug' | 'info' | 'warn' | 'error';
}

export interface SwwwConfig {
    transition_type: 'simple' | 'wipe' | 'grow' | 'outer' | 'wave';
    transition_step: number;
    transition_duration: number;
    transition_angle: number;
    transition_pos: 'center' | 'top' | 'bottom' | 'left' | 'right';
    transition_bezier: string;
    transition_wave: string;
}

export interface BackendConfig {
    type: 'swww' | 'feh' | 'nitrogen' | 'custom';
    swww?: SwwwConfig;
}

export interface MonitorsConfig {
    selected_monitors: string[];
    image_set_type: 'individual' | 'extend' | 'clone';
}

export interface WaypaperConfig {
    app: AppConfig;
    daemon: DaemonConfig;
    backend: BackendConfig;
    monitors: MonitorsConfig;
}

export class ConfigManager {
    private configPath: string;
    private config: WaypaperConfig | null = null;
    private watchers: Set<(config: WaypaperConfig) => void> = new Set();
    private fileWatcher: any = null;

    constructor(configPath?: string) {
        if (configPath) {
            this.configPath = configPath;
        } else {
            // Use XDG_CONFIG_HOME or fallback to ~/.config
            const configDir = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
            this.configPath = join(configDir, 'waypaper-engine', 'config.toml');
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
            const data = await fs.readFile(this.configPath, 'utf-8');
            this.config = toml.parse(data) as WaypaperConfig;
            
            // Expand tilde paths
            this.config = this.expandPaths(this.config);
            
            console.log('🟢 ConfigManager: Loaded config from', this.configPath);
        } catch (error) {
            // If file doesn't exist or is invalid, use defaults
            console.log('🟡 ConfigManager: Using default config, file not found or invalid');
            this.config = this.getDefaultConfig();
            await this.saveConfig();
        }

        return this.config!;
    }

    async saveConfig(): Promise<void> {
        if (!this.config) {
            console.warn('🟡 ConfigManager: No config to save');
            return;
        }

        try {
            // Ensure the config directory exists
            const configDir = dirname(this.configPath);
            await fs.mkdir(configDir, { recursive: true });

            // Convert paths back to tilde notation for storage
            const configToSave = this.contractPaths(this.config);

            // Write the config file
            const tomlContent = toml.stringify(configToSave);
            await fs.writeFile(this.configPath, tomlContent, 'utf-8');
            console.log('🟢 ConfigManager: Saved config to', this.configPath);
        } catch (error) {
            console.error('🔴 ConfigManager: Failed to save config:', error);
            throw error;
        }
    }

    async updateConfig(updates: Partial<WaypaperConfig>): Promise<void> {
        const currentConfig = await this.loadConfig();
        this.config = this.deepMerge(currentConfig, updates);
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
            const { watch } = await import('fs');
            this.fileWatcher = watch(this.configPath, async (eventType) => {
                if (eventType === 'change') {
                    try {
                        const data = await fs.readFile(this.configPath, 'utf-8');
                        this.config = this.expandPaths(toml.parse(data) as WaypaperConfig);
                        this.notifyWatchers();
                        console.log('🟢 ConfigManager: Config file changed, reloaded');
                    } catch (error) {
                        console.error('🔴 ConfigManager: Failed to reload config:', error);
                    }
                }
            });
            console.log('🟢 ConfigManager: Started watching config file');
        } catch (error) {
            console.error('🔴 ConfigManager: Failed to start watching:', error);
        }
    }

    stopWatching(): void {
        if (this.fileWatcher) {
            this.fileWatcher.close();
            this.fileWatcher = null;
            console.log('🟢 ConfigManager: Stopped watching config file');
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
        if (this.config) {
            this.watchers.forEach(callback => {
                try {
                    callback(this.config!);
                } catch (error) {
                    console.error('🔴 ConfigManager: Error in config watcher:', error);
                }
            });
        }
    }

    private expandPaths(config: WaypaperConfig): WaypaperConfig {
        const expandPath = (path: string): string => {
            if (path.startsWith('~/')) {
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
            }
        };
    }

    private contractPaths(config: WaypaperConfig): WaypaperConfig {
        const contractPath = (path: string): string => {
            const home = homedir();
            if (path.startsWith(home)) {
                return '~' + path.slice(home.length);
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
            }
        };
    }

    private deepMerge(target: any, source: any): any {
        const result = { ...target };
        
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(target[key] || {}, source[key]);
            } else {
                result[key] = source[key];
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
                random_image_monitor: 'individual',
                show_monitor_modal_on_start: false,
                images_per_page: 20,
                theme: 'dark',
                sidebar_collapsed: false,
                sort_by: 'name',
                sort_order: 'asc'
            },
            daemon: {
                database_path: '~/.config/waypaper-engine/waypaper.db',
                images_dir: '~/.waypaper-engine/images',
                thumbnails_dir: '~/.cache/waypaper-engine/thumbnails',
                monitors_state_file: '~/.cache/waypaper-engine/monitors.json',
                socket_path: '/tmp/waypaper-engine.sock',
                log_level: 'info'
            },
            backend: {
                type: 'swww',
                swww: {
                    transition_type: 'simple',
                    transition_step: 90,
                    transition_duration: 200,
                    transition_angle: 45,
                    transition_pos: 'center',
                    transition_bezier: '0.4,0.0,0.2,1',
                    transition_wave: '0,0,0,0'
                }
            },
            monitors: {
                selected_monitors: [],
                image_set_type: 'individual'
            }
        };
    }
}

// Export a singleton instance
export const configManager = new ConfigManager();
