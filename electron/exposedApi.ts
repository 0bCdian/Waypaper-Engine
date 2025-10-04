import { ipcRenderer } from "electron";

export const ELECTRON_API = {
    // Go daemon API
    goDaemon: {
        // Playlist operations
        startPlaylist: async (playlistName: string, activeMonitor: any) => {
            return await ipcRenderer.invoke("go-daemon-command", "start_playlist", { playlistName, activeMonitor });
        },
        stopPlaylist: async (monitorName: string) => {
            return await ipcRenderer.invoke("go-daemon-command", "stop_playlist", { activeMonitor: { name: monitorName } });
        },
        pausePlaylist: async (monitorName: string) => {
            return await ipcRenderer.invoke("go-daemon-command", "pause_playlist", { activeMonitor: { name: monitorName } });
        },
        resumePlaylist: async (monitorName: string) => {
            return await ipcRenderer.invoke("go-daemon-command", "resume_playlist", { activeMonitor: { name: monitorName } });
        },
        nextImage: async (monitorName: string) => {
            return await ipcRenderer.invoke("go-daemon-command", "next_image", { activeMonitor: { name: monitorName } });
        },
        previousImage: async (monitorName: string) => {
            return await ipcRenderer.invoke("go-daemon-command", "previous_image", { activeMonitor: { name: monitorName } });
        },
        randomImage: async (monitorName: string) => {
            return await ipcRenderer.invoke("go-daemon-command", "random_image", { activeMonitor: { name: monitorName } });
        },
        setImage: async (imageId: number, monitorName: string) => {
            return await ipcRenderer.invoke("go-daemon-command", "set_image", { image: { id: imageId }, activeMonitor: { name: monitorName } });
        },
        
        // Multi-monitor operations
        setImageAcrossMonitors: async (imageId: number, activeMonitor: any) => {
            return await ipcRenderer.invoke("go-daemon-command", "set_image_across_monitors", { image: { id: imageId }, activeMonitor });
        },
        duplicateImageAcrossMonitors: async (imageId: number, activeMonitor: any) => {
            return await ipcRenderer.invoke("go-daemon-command", "duplicate_image_across_monitors", { image: { id: imageId }, activeMonitor });
        },
        processForMonitors: async (imageId: number, activeMonitor: any) => {
            return await ipcRenderer.invoke("go-daemon-command", "process_for_monitors", { image: { id: imageId }, activeMonitor });
        },
        
        // Data queries
        getImages: async (filters?: any) => {
            return await ipcRenderer.invoke("go-daemon-command", "get_images", { filters });
        },
        getPlaylists: async () => {
            return await ipcRenderer.invoke("go-daemon-command", "get_playlists");
        },
        getActivePlaylist: async (activeMonitor: any) => {
            return await ipcRenderer.invoke("go-daemon-command", "get_active_playlist", { activeMonitor });
        },
        savePlaylist: async (playlist: any) => {
            return await ipcRenderer.invoke("go-daemon-command", "save_playlist", playlist);
        },
        deletePlaylist: async (playlistName: string) => {
            return await ipcRenderer.invoke("go-daemon-command", "delete_playlist", { playlistName });
        },
        getImageSrc: async (imageName: string) => {
            return await ipcRenderer.invoke("go-daemon-command", "get_image_src", { fileName: imageName });
        },
        getThumbnailSrc: async (imageName: string) => {
            return await ipcRenderer.invoke("go-daemon-command", "get_thumbnail_src", { fileName: imageName });
        },
        getMonitorImage: async (monitorName: string) => {
            return await ipcRenderer.invoke("go-daemon-command", "get_monitor_image", { monitorName });
        },
        deleteImage: async (imageId: number) => {
            return await ipcRenderer.invoke("go-daemon-command", "delete_image", { imageId });
        },
        deleteImagesFromGallery: async (imageIds: number[]) => {
            return await ipcRenderer.invoke("go-daemon-command", "delete_image_from_gallery", { imageIds });
        },
        openContextMenu: async (data: any) => {
            return await ipcRenderer.invoke("openContextMenuImage", data.Image, data.selectedImagesLength);
        },
        exitApp: async () => {
            return await ipcRenderer.invoke("exitApp");
        },
        getPlaylistImages: async (playlistId: number) => {
            return await ipcRenderer.invoke("go-daemon-command", "get_playlist_images", { playlistId });
        },
        updateTray: async () => {
            return await ipcRenderer.invoke("go-daemon-command", "update_tray");
        },
        getInfo: async () => {
            return await ipcRenderer.invoke("go-daemon-command", "get_info");
        },
        
        // Configuration
        getAppConfig: async () => {
            return await ipcRenderer.invoke("go-daemon-command", "get_app_config");
        },
        setAppConfig: async (key: string, value: any) => {
            return await ipcRenderer.invoke("go-daemon-command", "set_app_config", { key, value });
        },
        getSwwwConfig: async () => {
            return await ipcRenderer.invoke("go-daemon-command", "get_swww_config");
        },
        setSwwwConfig: async (config: any) => {
            return await ipcRenderer.invoke("go-daemon-command", "set_swww_config", config);
        },
        
        // Monitor operations
        setSelectedMonitor: async (activeMonitor: any) => {
            return await ipcRenderer.invoke("go-daemon-command", "set_selected_monitor", { activeMonitor });
        },
        getMonitors: async () => {
            return await ipcRenderer.invoke("go-daemon-command", "get_monitors");
        },
        getSelectedMonitor: async () => {
            return await ipcRenderer.invoke("go-daemon-command", "get_selected_monitor");
        },
        
        // System operations
        getDaemonStatus: async () => {
            return await ipcRenderer.invoke("go-daemon-command", "get_daemon_status");
        },
        stopDaemon: async () => {
            return await ipcRenderer.invoke("go-daemon-command", "stop_daemon");
        },
        ping: async () => {
            return await ipcRenderer.invoke("go-daemon-command", "ping");
        },
        
        // Event listeners
        on: (event: string, callback: (...args: any[]) => void) => {
            ipcRenderer.on(`go-daemon-event-${event}`, (_, ...args) => callback(...args));
        },
        off: (event: string, callback: (...args: any[]) => void) => {
            ipcRenderer.off(`go-daemon-event-${event}`, callback);
        }
    },
    
    // Legacy API functions that are still needed
    openFiles: async (action: any) => {
        return await ipcRenderer.invoke("openFiles", action);
    },
    handleOpenImages: async (imagesObject: any) => {
        return await ipcRenderer.invoke("handleOpenImages", imagesObject);
    },
    
    // Backward compatibility: top-level savePlaylist for existing components
    savePlaylist: (playlist: any) => {
        ipcRenderer.send("savePlaylist", playlist);
    }
};

// For backward compatibility, expose the API on window
declare global {
    interface Window {
        API_RENDERER: typeof ELECTRON_API;
    }
}

window.API_RENDERER = ELECTRON_API;