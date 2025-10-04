import { ipcRenderer } from "electron";

export interface GoDaemonRendererClient {
    // Playlist operations
    startPlaylist(playlistId: number, activeMonitor: any): Promise<any>;
    stopPlaylist(monitorName: string): Promise<any>;
    pausePlaylist(monitorName: string): Promise<any>;
    resumePlaylist(monitorName: string): Promise<any>;
    
    // Image navigation
    nextImage(monitorName: string): Promise<any>;
    previousImage(monitorName: string): Promise<any>;
    randomImage(monitorName: string): Promise<any>;
    setImage(imageId: number, monitorName: string): Promise<any>;
    
    // Data queries
    getImages(filters?: any): Promise<any>;
    getPlaylists(): Promise<any>;
    getInfo(): Promise<any>;
    
    // Configuration
    getAppConfig(): Promise<any>;
    setAppConfig(key: string, value: any): Promise<any>;
    getSwwwConfig(): Promise<any>;
    setSwwwConfig(config: any): Promise<any>;
    
    // System
    ping(): Promise<any>;
    getDaemonStatus(): Promise<any>;
    stopDaemon(): Promise<any>;
    
    // Bulk operations
    nextImageAll(monitors?: string[]): Promise<any>;
    previousImageAll(monitors?: string[]): Promise<any>;
    randomImageAll(monitors?: string[]): Promise<any>;
    stopPlaylistAll(): Promise<any>;
    pausePlaylistAll(): Promise<any>;
    resumePlaylistAll(): Promise<any>;
    
    // Event listeners
    on(event: string, callback: (data: any) => void): void;
    off(event: string, callback: (data: any) => void): void;
}

class GoDaemonRendererClientImpl implements GoDaemonRendererClient {
    // Playlist operations
    async startPlaylist(playlistId: number, activeMonitor: any): Promise<any> {
        return ipcRenderer.invoke("go-daemon-command", "start_playlist", { playlistId, activeMonitor });
    }

    async stopPlaylist(monitorName: string): Promise<any> {
        return ipcRenderer.invoke("go-daemon-command", "stop_playlist", { activeMonitor: { name: monitorName } });
    }

    async pausePlaylist(monitorName: string): Promise<any> {
        return ipcRenderer.invoke("go-daemon-command", "pause_playlist", { activeMonitor: { name: monitorName } });
    }

    async resumePlaylist(monitorName: string): Promise<any> {
        return ipcRenderer.invoke("go-daemon-command", "resume_playlist", { activeMonitor: { name: monitorName } });
    }

    // Image navigation
    async nextImage(monitorName: string): Promise<any> {
        return ipcRenderer.invoke("go-daemon-command", "next_image", { activeMonitor: { name: monitorName } });
    }

    async previousImage(monitorName: string): Promise<any> {
        return ipcRenderer.invoke("go-daemon-command", "previous_image", { activeMonitor: { name: monitorName } });
    }

    async randomImage(monitorName: string): Promise<any> {
        return ipcRenderer.invoke("go-daemon-command", "random_image", { activeMonitor: { name: monitorName } });
    }

    async setImage(imageId: number, monitorName: string): Promise<any> {
        const payload = { image: { id: imageId }, activeMonitor: { name: monitorName } };
        console.log("🔵 RendererClient: setImage called with imageId:", imageId, "monitorName:", monitorName);
        console.log("🔵 RendererClient: setImage payload:", payload);
        return ipcRenderer.invoke("go-daemon-command", "set_image", payload);
    }

    // Data queries
    async getImages(filters?: any): Promise<any> {
        return ipcRenderer.invoke("go-daemon-command", "get_images", { filters });
    }

    async getPlaylists(): Promise<any> {
        return ipcRenderer.invoke("go-daemon-command", "get_playlists");
    }

    async getInfo(): Promise<any> {
        return ipcRenderer.invoke("go-daemon-command", "get_info");
    }

    // Configuration
    async getAppConfig(): Promise<any> {
        return ipcRenderer.invoke("go-daemon-command", "get_app_config");
    }

    async setAppConfig(key: string, value: any): Promise<any> {
        return ipcRenderer.invoke("go-daemon-command", "set_app_config", { key, value });
    }

    async getSwwwConfig(): Promise<any> {
        return ipcRenderer.invoke("go-daemon-command", "get_swww_config");
    }

    async setSwwwConfig(config: any): Promise<any> {
        return ipcRenderer.invoke("go-daemon-command", "set_swww_config", config);
    }

    // System
    async ping(): Promise<any> {
        return ipcRenderer.invoke("go-daemon-command", "ping");
    }

    async getDaemonStatus(): Promise<any> {
        return ipcRenderer.invoke("go-daemon-command", "get_daemon_status");
    }

    async stopDaemon(): Promise<any> {
        return ipcRenderer.invoke("go-daemon-command", "stop_daemon");
    }

    // Bulk operations
    async nextImageAll(monitors?: string[]): Promise<any> {
        return ipcRenderer.invoke("go-daemon-command", "next_image_all", { monitors });
    }

    async previousImageAll(monitors?: string[]): Promise<any> {
        return ipcRenderer.invoke("go-daemon-command", "previous_image_all", { monitors });
    }

    async randomImageAll(monitors?: string[]): Promise<any> {
        return ipcRenderer.invoke("go-daemon-command", "random_image_all", { monitors });
    }

    async stopPlaylistAll(): Promise<any> {
        return ipcRenderer.invoke("go-daemon-command", "stop_playlist_all");
    }

    async pausePlaylistAll(): Promise<any> {
        return ipcRenderer.invoke("go-daemon-command", "pause_playlist_all");
    }

    async resumePlaylistAll(): Promise<any> {
        return ipcRenderer.invoke("go-daemon-command", "resume_playlist_all");
    }

    // Event listeners
    on(event: string, callback: (data: any) => void): void {
        ipcRenderer.on(`go-daemon-event-${event}`, (_, data) => callback(data));
    }

    off(event: string, callback: (data: any) => void): void {
        ipcRenderer.off(`go-daemon-event-${event}`, callback);
    }
}

// Export singleton instance
export const goDaemonRendererClient = new GoDaemonRendererClientImpl();
