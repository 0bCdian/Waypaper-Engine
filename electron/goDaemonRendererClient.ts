import { ipcRenderer } from "electron";
import type { 
    DaemonImage, 
    DaemonPlaylist,
    DaemonAppConfig,
    DaemonSwwwConfig
} from "../shared/types/daemon";
import type { ActiveMonitor } from "../shared/types/monitor";

export interface GoDaemonRendererClient {
    // Playlist operations
    startPlaylist(playlistId: number, activeMonitor: ActiveMonitor): Promise<boolean>;
    stopPlaylist(monitorName: string): Promise<boolean>;
    pausePlaylist(monitorName: string): Promise<boolean>;
    resumePlaylist(monitorName: string): Promise<boolean>;

    // Image navigation
    nextImage(monitorName: string): Promise<boolean>;
    previousImage(monitorName: string): Promise<boolean>;
    randomImage(monitorName: string): Promise<boolean>;
    setImage(imageId: number, monitorName: string): Promise<boolean>;

    // Data queries
    getImages(filters?: unknown): Promise<DaemonImage[]>;
    getPlaylists(): Promise<DaemonPlaylist[]>;
    getInfo(): Promise<unknown>;

    // Configuration
    getAppConfig(): Promise<DaemonAppConfig>;
    setAppConfig(key: string, value: unknown): Promise<boolean>;
    getSwwwConfig(): Promise<DaemonSwwwConfig>;
    setSwwwConfig(config: DaemonSwwwConfig): Promise<boolean>;

    // System
    ping(): Promise<boolean>;
    getDaemonStatus(): Promise<unknown>;
    stopDaemon(): Promise<boolean>;

    // Bulk operations
    nextImageAll(monitors?: string[]): Promise<boolean>;
    previousImageAll(monitors?: string[]): Promise<boolean>;
    randomImageAll(monitors?: string[]): Promise<boolean>;
    stopPlaylistAll(): Promise<boolean>;
    pausePlaylistAll(): Promise<boolean>;
    resumePlaylistAll(): Promise<boolean>;

    // Event listeners
    on(event: string, callback: (data: unknown) => void): void;
    off(event: string, callback: (data: unknown) => void): void;
}

class GoDaemonRendererClientImpl implements GoDaemonRendererClient {
    // Playlist operations
    async startPlaylist(playlistId: number, activeMonitor: ActiveMonitor): Promise<boolean> {
        return ipcRenderer.invoke("go-daemon-command", "start_playlist", {
            playlistId,
            activeMonitor
        });
    }

    async stopPlaylist(monitorName: string): Promise<boolean> {
        return ipcRenderer.invoke("go-daemon-command", "stop_playlist", {
            activeMonitor: { name: monitorName }
        });
    }

    async pausePlaylist(monitorName: string): Promise<boolean> {
        return ipcRenderer.invoke("go-daemon-command", "pause_playlist", {
            activeMonitor: { name: monitorName }
        });
    }

    async resumePlaylist(monitorName: string): Promise<boolean> {
        return ipcRenderer.invoke("go-daemon-command", "resume_playlist", {
            activeMonitor: { name: monitorName }
        });
    }

    // Image navigation
    async nextImage(monitorName: string): Promise<boolean> {
        return ipcRenderer.invoke("go-daemon-command", "next_image", {
            activeMonitor: { name: monitorName }
        });
    }

    async previousImage(monitorName: string): Promise<boolean> {
        return ipcRenderer.invoke("go-daemon-command", "previous_image", {
            activeMonitor: { name: monitorName }
        });
    }

    async randomImage(monitorName: string): Promise<boolean> {
        return ipcRenderer.invoke("go-daemon-command", "random_image", {
            activeMonitor: { name: monitorName }
        });
    }

    async setImage(imageId: number, monitorName: string): Promise<boolean> {
        const payload = {
            image: { id: imageId },
            activeMonitor: { name: monitorName }
        };
        console.log(
            "🔵 RendererClient: setImage called with imageId:",
            imageId,
            "monitorName:",
            monitorName
        );
        console.log("🔵 RendererClient: setImage payload:", payload);
        return ipcRenderer.invoke("go-daemon-command", "set_image", payload);
    }

    // Data queries
    async getImages(filters?: unknown): Promise<DaemonImage[]> {
        return ipcRenderer.invoke("go-daemon-command", "get_images", {
            filters
        });
    }

    async getPlaylists(): Promise<DaemonPlaylist[]> {
        return ipcRenderer.invoke("go-daemon-command", "get_playlists");
    }

    async getInfo(): Promise<unknown> {
        return ipcRenderer.invoke("go-daemon-command", "get_info");
    }

    // Configuration
    async getAppConfig(): Promise<DaemonAppConfig> {
        return ipcRenderer.invoke("go-daemon-command", "get_app_config");
    }

    async setAppConfig(key: string, value: unknown): Promise<boolean> {
        return ipcRenderer.invoke("go-daemon-command", "set_app_config", {
            key,
            value
        });
    }

    async getSwwwConfig(): Promise<DaemonSwwwConfig> {
        return ipcRenderer.invoke("go-daemon-command", "get_swww_config");
    }

    async setSwwwConfig(config: DaemonSwwwConfig): Promise<boolean> {
        return ipcRenderer.invoke(
            "go-daemon-command",
            "set_swww_config",
            config
        );
    }

    // System
    async ping(): Promise<boolean> {
        return ipcRenderer.invoke("go-daemon-command", "ping");
    }

    async getDaemonStatus(): Promise<unknown> {
        return ipcRenderer.invoke("go-daemon-command", "get_daemon_status");
    }

    async stopDaemon(): Promise<boolean> {
        return ipcRenderer.invoke("go-daemon-command", "stop_daemon");
    }

    // Bulk operations
    async nextImageAll(monitors?: string[]): Promise<boolean> {
        return ipcRenderer.invoke("go-daemon-command", "next_image_all", {
            monitors
        });
    }

    async previousImageAll(monitors?: string[]): Promise<boolean> {
        return ipcRenderer.invoke("go-daemon-command", "previous_image_all", {
            monitors
        });
    }

    async randomImageAll(monitors?: string[]): Promise<boolean> {
        return ipcRenderer.invoke("go-daemon-command", "random_image_all", {
            monitors
        });
    }

    async stopPlaylistAll(): Promise<boolean> {
        return ipcRenderer.invoke("go-daemon-command", "stop_playlist_all");
    }

    async pausePlaylistAll(): Promise<boolean> {
        return ipcRenderer.invoke("go-daemon-command", "pause_playlist_all");
    }

    async resumePlaylistAll(): Promise<boolean> {
        return ipcRenderer.invoke("go-daemon-command", "resume_playlist_all");
    }

    // Event listeners
    on(event: string, callback: (data: unknown) => void): void {
        ipcRenderer.on(`go-daemon-event-${event}`, (_, data) => callback(data));
    }

    off(event: string, callback: (data: unknown) => void): void {
        ipcRenderer.off(`go-daemon-event-${event}`, callback);
    }
}

// Export singleton instance
export const goDaemonRendererClient = new GoDaemonRendererClientImpl();
