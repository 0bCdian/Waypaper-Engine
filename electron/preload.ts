/**
 * Preload Script for Waypaper Engine
 * 
 * Restored original functionality with theme enhancements.
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { ActiveMonitor } from '../shared/types/monitor';
import type { JsonStoreImage, DaemonPlaylist, DaemonAppConfig, DaemonSwwwConfig } from '../shared/types/daemon';
import type { rendererPlaylist } from '../src/types/rendererTypes';

// Create the API object using your original system
const electronAPI = {
  // Your original Go daemon client
  goDaemon: {
    // Playlist operations
    startPlaylist: (playlistId: number, activeMonitor: ActiveMonitor) => ipcRenderer.invoke("go-daemon-command", "start_playlist", { playlistId, activeMonitor }),
    stopPlaylist: (activeMonitor: ActiveMonitor) => ipcRenderer.invoke("go-daemon-command", "stop_playlist", { activeMonitor }),
    pausePlaylist: (activeMonitor: ActiveMonitor) => ipcRenderer.invoke("go-daemon-command", "pause_playlist", { activeMonitor }),
    resumePlaylist: (activeMonitor: ActiveMonitor) => ipcRenderer.invoke("go-daemon-command", "resume_playlist", { activeMonitor }),
    savePlaylist: (playlist: rendererPlaylist) => ipcRenderer.invoke("go-daemon-command", "save_playlist", { playlist }),
    deletePlaylist: (playlistName: string) => ipcRenderer.invoke("go-daemon-command", "delete_playlist", { playlistName }),
    getActivePlaylist: (activeMonitor: ActiveMonitor) => ipcRenderer.invoke("go-daemon-command", "get_active_playlist", { activeMonitor }),
    getPlaylistImages: (playlistId: number) => ipcRenderer.invoke("go-daemon-command", "get_playlist_images", { playlistId }),

    // Image navigation
    nextImage: (activeMonitor: ActiveMonitor) => ipcRenderer.invoke("go-daemon-command", "next_image", { activeMonitor }),
    previousImage: (activeMonitor: ActiveMonitor) => ipcRenderer.invoke("go-daemon-command", "previous_image", { activeMonitor }),
    randomImage: (activeMonitor: ActiveMonitor) => ipcRenderer.invoke("go-daemon-command", "random_image", { activeMonitor }),
    setImage: (imageId: number, monitorName: string) => ipcRenderer.invoke("go-daemon-command", "set_image", { image: { id: imageId }, activeMonitor: { name: monitorName } }),

    // Multi-monitor operations
    setImageAcrossMonitors: (imageId: number, activeMonitor: ActiveMonitor) => ipcRenderer.invoke("go-daemon-command", "set_image_across_monitors", { image: { id: imageId }, activeMonitor }),
    duplicateImageAcrossMonitors: (imageId: number, activeMonitor: ActiveMonitor) => ipcRenderer.invoke("go-daemon-command", "duplicate_image_across_monitors", { image: { id: imageId }, activeMonitor }),
    processForMonitors: (imageId: number, activeMonitor: ActiveMonitor) => ipcRenderer.invoke("go-daemon-command", "process_for_monitors", { image: { id: imageId }, activeMonitor }),

    // Data queries
    getImages: (filters?: unknown) => ipcRenderer.invoke("go-daemon-command", "get_images", { filters }),
    getPlaylists: () => ipcRenderer.invoke("go-daemon-command", "get_playlists"),
    getImageHistory: () => ipcRenderer.invoke("go-daemon-command", "get_image_history"),
    deleteImagesFromGallery: (imageIds: number[]) => ipcRenderer.invoke("go-daemon-command", "delete_image_from_gallery", { imageIds }),
    getDiagnostics: (monitorName?: string) => ipcRenderer.invoke("go-daemon-command", "get_diagnostics", { monitorName }),

    // Unified configuration
    getConfig: () => ipcRenderer.invoke("go-daemon-command", "get_config"),
    setConfig: (section: string, key: string, value: unknown) => ipcRenderer.invoke("go-daemon-command", "set_config", {
      Config: {
        ConfigSection: section,
        ConfigKey: key,
        ConfigValue: value
      }
    }),
    
    // Event listening for config changes
    onConfigChanged: (callback: (data: any) => void) => {
      ipcRenderer.on("go-daemon-event-config_changed", (_, data) => callback(data));
    },
    offConfigChanged: (callback: (data: any) => void) => {
      ipcRenderer.off("go-daemon-event-config_changed", callback);
    },

    // Legacy configuration (keep for backward compatibility)
    getAppConfig: () => ipcRenderer.invoke("go-daemon-command", "get_app_config"),
    setAppConfig: (key: string, value: unknown) => ipcRenderer.invoke("go-daemon-command", "set_app_config", { key, value }),
    getSwwwConfig: () => ipcRenderer.invoke("go-daemon-command", "get_swww_config"),
    setSwwwConfig: (config: DaemonSwwwConfig) => ipcRenderer.invoke("go-daemon-command", "set_swww_config", config),

    // Monitor operations
    getMonitors: () => ipcRenderer.invoke("go-daemon-command", "get_monitors"),
    setSelectedMonitor: (activeMonitor: ActiveMonitor) => ipcRenderer.invoke("go-daemon-command", "set_selected_monitor", { activeMonitor }),
    getSelectedMonitor: () => ipcRenderer.invoke("go-daemon-command", "get_selected_monitor"),

    // Image processing
    processImages: (imagePaths: string[], fileNames: string[]) => ipcRenderer.invoke("go-daemon-command", "process_images", { imagePaths, fileNames }),

    // System
    ping: () => ipcRenderer.invoke("go-daemon-command", "ping"),
    getDaemonStatus: () => ipcRenderer.invoke("go-daemon-command", "get_daemon_status"),
    stopDaemon: () => ipcRenderer.invoke("go-daemon-command", "stop_daemon"),

    // Event listeners - properly wrapped according to Electron docs
    on: (event: string, callback: (data: any) => void) => {
      ipcRenderer.on(`go-daemon-event-${event}`, (_, data) => callback(data));
    },
    off: (event: string, callback: (data: any) => void) => {
      ipcRenderer.off(`go-daemon-event-${event}`, callback);
    }
  },
  
  // Theme management (new)
  getNativeTheme: () => ipcRenderer.invoke('get-native-theme'),
  setThemeSource: (source: 'system' | 'light' | 'dark') => ipcRenderer.invoke('set-theme-source', source),
  onNativeThemeUpdated: (callback: (themeInfo: any) => void) => {
    ipcRenderer.on('native-theme-updated', (_, themeInfo) => callback(themeInfo));
  },
  onThemeChanged: (callback: (data: any) => void) => {
    ipcRenderer.on('theme-changed', (_, data) => callback(data));
  },
  
  // System info (new)
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  ping: () => ipcRenderer.invoke('ping'),
  
  // Window management (new)
  getWindowBounds: () => ipcRenderer.invoke('get-window-bounds'),
  setWindowBounds: (bounds: any) => ipcRenderer.invoke('set-window-bounds', bounds),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  hideWindow: () => ipcRenderer.invoke('hide-window'),
  showWindow: () => ipcRenderer.invoke('show-window'),
  
  // Event listeners
  onAppError: (callback: (error: any) => void) => {
    ipcRenderer.on('app-error', (_, error) => callback(error));
  },
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
  
  // File operations
  openFiles: (action: any) => ipcRenderer.invoke('openFiles', action),
  handleOpenImages: (imagesObject: any) => ipcRenderer.invoke('handleOpenImages', imagesObject),
};

// Debug: Log the goDaemon object to see what methods are available
console.log('🔍 Preload: goDaemon object:', electronAPI.goDaemon);
console.log('🔍 Preload: goDaemon.getAppConfig:', typeof electronAPI.goDaemon.getAppConfig);
console.log('🔍 Preload: goDaemon.setAppConfig:', typeof electronAPI.goDaemon.setAppConfig);
console.log('🔍 Preload: goDaemon.on:', typeof electronAPI.goDaemon.on);
console.log('🔍 Preload: goDaemon.getPlaylists:', typeof electronAPI.goDaemon.getPlaylists);
console.log('🔍 Preload: goDaemon.getMonitors:', typeof electronAPI.goDaemon.getMonitors);

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('API_RENDERER', electronAPI);

// Log successful preload
console.log('Preload script loaded successfully');