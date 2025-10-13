/**
 * IPC Manager for Electron Main Process
 * 
 * Centralized IPC handler management for better organization and error handling.
 */

import { ipcMain, BrowserWindow, dialog, app } from 'electron';
import { goDaemonClient } from '../goDaemonClient';
import { daemonMonitor } from './DaemonMonitor';
import type { JsonStoreImage } from '../shared/types/daemon';

export interface IPCHandler {
  channel: string;
  handler: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => Promise<any> | any;
  description?: string;
}

export class IPCManager {
  private handlers: Map<string, IPCHandler> = new Map();
  private windows: Set<BrowserWindow> = new Set();
  private isInitialized = false;

  /**
   * Initialize the IPC manager
   */
  initialize(): void {
    if (this.isInitialized) return;

    this.setupDefaultHandlers();
    this.setupGoDaemonHandlers();
    this.setupThemeHandlers();
    this.setupWindowHandlers();
    this.setupErrorHandling();

    this.isInitialized = true;
    console.log('IPC Manager initialized');
  }

  /**
   * Register a window for IPC communication
   */
  registerWindow(window: BrowserWindow): void {
    this.windows.add(window);
  }

  /**
   * Unregister a window
   */
  unregisterWindow(window: BrowserWindow): void {
    this.windows.delete(window);
  }

  /**
   * Register a custom IPC handler
   */
  registerHandler(handler: IPCHandler): void {
    if (this.handlers.has(handler.channel)) {
      console.warn(`IPC handler already exists for channel: ${handler.channel}`);
      return;
    }

    // Check if handler already exists in Electron
    if (ipcMain.listenerCount(handler.channel) > 0) {
      console.warn(`IPC handler already registered in Electron for channel: ${handler.channel}`);
      return;
    }

    this.handlers.set(handler.channel, handler);
    
    // List of channels that should return unwrapped data (not wrapped in {success, data})
    const unwrappedChannels = [
      'go-daemon-command'
    ];
    
    ipcMain.handle(handler.channel, async (event, ...args) => {
      try {
        console.log(`IPC call: ${handler.channel}`, args);
        const result = await handler.handler(event, ...args);
        
        // For go-daemon-command, return unwrapped data
        if (unwrappedChannels.includes(handler.channel)) {
          return result;
        }
        
        // For other channels, wrap in success/data format
        return { success: true, data: result };
      } catch (error) {
        console.error(`IPC error: ${handler.channel}`, error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    console.log(`IPC handler registered: ${handler.channel}`);
  }

  /**
   * Unregister an IPC handler
   */
  unregisterHandler(channel: string): void {
    if (!this.handlers.has(channel)) return;

    ipcMain.removeHandler(channel);
    this.handlers.delete(channel);
    console.log(`IPC handler unregistered: ${channel}`);
  }

  /**
   * Setup default IPC handlers
   */
  private setupDefaultHandlers(): void {
    // Ping handler
    this.registerHandler({
      channel: 'ping',
      handler: async () => {
        return { message: 'pong', timestamp: Date.now() };
      },
      description: 'Ping-pong handler for connection testing',
    });

    // App info handler
    this.registerHandler({
      channel: 'get-app-info',
      handler: async () => {
        return {
          name: 'Waypaper Engine',
          version: '2.0.4',
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version,
          electronVersion: process.versions.electron,
        };
      },
      description: 'Get application information',
    });

    // Window bounds handler
    this.registerHandler({
      channel: 'get-window-bounds',
      handler: async (event) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (!window) return null;
        return window.getBounds();
      },
      description: 'Get current window bounds',
    });

    // Set window bounds handler
    this.registerHandler({
      channel: 'set-window-bounds',
      handler: async (event, bounds) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (!window) return false;
        window.setBounds(bounds);
        return true;
      },
      description: 'Set window bounds',
    });

    // Exit app handler
    this.registerHandler({
      channel: 'exit-app',
      handler: async () => {
        return await this.handleExitApp();
      },
      description: 'Handle clean application exit',
    });

    // Daemon status handler
    this.registerHandler({
      channel: 'get-daemon-status',
      handler: async () => {
        return daemonMonitor.getStatus();
      },
      description: 'Get current daemon status',
    });

    // Daemon restart handler
    this.registerHandler({
      channel: 'restart-daemon',
      handler: async () => {
        return await daemonMonitor.restartDaemon();
      },
      description: 'Restart the daemon',
    });

    // Daemon start handler
    this.registerHandler({
      channel: 'start-daemon',
      handler: async () => {
        return await daemonMonitor.startDaemon();
      },
      description: 'Start the daemon',
    });

    // Daemon stop handler
    this.registerHandler({
      channel: 'stop-daemon',
      handler: async () => {
        return await daemonMonitor.stopDaemon();
      },
      description: 'Stop the daemon',
    });
  }

  /**
   * Setup Go daemon IPC handlers
   */
  private setupGoDaemonHandlers(): void {
    // Go daemon command handler - this is the main handler your renderer client uses
    this.registerHandler({
      channel: 'go-daemon-command',
      handler: async (_event, action: string, payload?: unknown) => {
        return await this.handleGoDaemonCommand(action, payload);
      },
      description: 'Handle Go daemon commands',
    });

    // Go daemon status handler
    this.registerHandler({
      channel: 'get-daemon-status',
      handler: async () => {
        return await goDaemonClient.getDaemonStatus();
      },
      description: 'Get Go daemon status',
    });

    // Go daemon ping handler
    this.registerHandler({
      channel: 'ping-daemon',
      handler: async () => {
        return await goDaemonClient.ping();
      },
      description: 'Ping Go daemon',
    });

    // File operations
    this.registerHandler({
      channel: 'openFiles',
      handler: async (_event, action) => {
        try {
          const mainWindow = BrowserWindow.getFocusedWindow();
          if (!mainWindow) {
            return { success: false, error: 'No focused window' };
          }

          let result;
          if (action === 'file') {
            result = await dialog.showOpenDialog(mainWindow, {
              title: 'Select Images',
              filters: [
                { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'] },
                { name: 'All Files', extensions: ['*'] }
              ],
              properties: ['openFile', 'multiSelections']
            });
          } else if (action === 'folder') {
            result = await dialog.showOpenDialog(mainWindow, {
              title: 'Select Folder',
              properties: ['openDirectory']
            });
          } else {
            return { success: false, error: 'Invalid action' };
          }

          if (result.canceled) {
            return { success: true, files: [] };
          }

          return { success: true, files: result.filePaths };
        } catch (error) {
          console.error('Error opening files:', error);
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      },
      description: 'Open files dialog',
    });

    this.registerHandler({
      channel: 'handleOpenImages',
      handler: async (_event, imagesObject) => {
        try {
          console.log('handleOpenImages called with:', imagesObject);
          
          if (!imagesObject.success || !imagesObject.data.files || imagesObject.data.files.length === 0) {
            return { success: true, message: 'No files to process' };
          }

          // Send files to Go daemon for processing
          const files = imagesObject.data.files;
          console.log('Sending files to Go daemon:', files);
          
          // Extract file paths and names
          const imagePaths = files;
          const fileNames = files.map((filePath: string) => {
            const pathParts = filePath.split('/');
            return pathParts[pathParts.length - 1]; // Get filename from path
          });

          console.log('Processing images with paths:', imagePaths, 'names:', fileNames);
          
          // Call Go daemon to process images
          const result = await goDaemonClient.processImages(imagePaths, fileNames);
          
          if (result) {
            console.log('Successfully processed images');
            return { success: true, message: `Successfully processed ${files.length} images` };
          } else {
            console.error('Failed to process images');
            return { success: false, error: 'Failed to process images' };
          }
        } catch (error) {
          console.error('Error handling open images:', error);
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      },
      description: 'Handle opened images',
    });

    // Setup event forwarding from Go daemon to renderer
    this.setupGoDaemonEventForwarding();
  }

  /**
   * Setup theme IPC handlers
   */
  private setupThemeHandlers(): void {
    // Get native theme handler
    this.registerHandler({
      channel: 'get-native-theme',
      handler: async () => {
        const { nativeTheme } = require('electron');
        return {
          shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
          shouldUseHighContrastColors: nativeTheme.shouldUseHighContrastColors,
          shouldUseInvertedColorScheme: nativeTheme.shouldUseInvertedColorScheme,
          themeSource: nativeTheme.themeSource,
        };
      },
      description: 'Get native theme information',
    });

    // Set theme source handler
    this.registerHandler({
      channel: 'set-theme-source',
      handler: async (_event, source: 'system' | 'light' | 'dark') => {
        const { nativeTheme } = require('electron');
        nativeTheme.themeSource = source;
        return true;
      },
      description: 'Set native theme source',
    });

    // Theme changed handler
    this.registerHandler({
      channel: 'theme-changed',
      handler: async (_event, themeName: string) => {
        console.log(`Theme changed to: ${themeName}`);
        // Broadcast to all windows
        this.broadcastToAllWindows('theme-changed', { themeName });
        return true;
      },
      description: 'Handle theme change notifications',
    });
  }

  /**
   * Setup window IPC handlers
   */
  private setupWindowHandlers(): void {
    // Minimize window handler
    this.registerHandler({
      channel: 'minimize-window',
      handler: async (event) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (!window) return false;
        window.minimize();
        return true;
      },
      description: 'Minimize current window',
    });

    // Maximize window handler
    this.registerHandler({
      channel: 'maximize-window',
      handler: async (event) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (!window) return false;
        if (window.isMaximized()) {
          window.unmaximize();
        } else {
          window.maximize();
        }
        return true;
      },
      description: 'Maximize/unmaximize current window',
    });

    // Close window handler
    this.registerHandler({
      channel: 'close-window',
      handler: async (event) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (!window) return false;
        window.close();
        return true;
      },
      description: 'Close current window',
    });

    // Hide window handler
    this.registerHandler({
      channel: 'hide-window',
      handler: async (event) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (!window) return false;
        window.hide();
        return true;
      },
      description: 'Hide current window',
    });

    // Show window handler
    this.registerHandler({
      channel: 'show-window',
      handler: async (event) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (!window) return false;
        window.show();
        return true;
      },
      description: 'Show current window',
    });
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    // Global error handler
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      this.broadcastToAllWindows('app-error', { 
        error: error.message,
        stack: error.stack 
      });
    });

    process.on('unhandledRejection', (reason, _promise) => {
      console.error('Unhandled Rejection:', reason);
      this.broadcastToAllWindows('app-error', { 
        error: 'Unhandled Promise Rejection',
        reason: reason?.toString() 
      });
    });
  }

  /**
   * Convert file paths to atom:// protocol for frontend consumption
   */
  private convertPathsToAtomProtocol(images: JsonStoreImage[]): JsonStoreImage[] {
    if (!Array.isArray(images)) {
      return images;
    }

    // Create new objects to avoid mutating the originals
    return images.map(image => {
      if (!image || typeof image !== 'object') {
        return image;
      }

      // Create a shallow copy of the image
      const convertedImage = { ...image };
      console.log('convertedImage', convertedImage);

      // Convert main image path (only if not already atom:)
      if (convertedImage.path && typeof convertedImage.path === 'string' && !convertedImage.path.startsWith('atom:')) {
        // Handle absolute paths properly - use atom: for absolute paths to avoid triple slashes
        if (convertedImage.path.startsWith('/')) {
          convertedImage.path = `atom:${convertedImage.path}`;
        } else {
          convertedImage.path = `atom://${convertedImage.path}`;
        }
      }

      // Convert thumbnail paths (only if not already atom:)
      if (convertedImage.thumbnails && typeof convertedImage.thumbnails === 'object') {
        // Create a copy of thumbnails to avoid mutating the original
        convertedImage.thumbnails = { ...convertedImage.thumbnails };
        Object.keys(convertedImage.thumbnails).forEach(key => {
          const thumbnailPath = convertedImage.thumbnails[key as keyof typeof convertedImage.thumbnails];
          if (thumbnailPath && typeof thumbnailPath === 'string' && !thumbnailPath.startsWith('atom:')) {
            // Handle absolute paths properly - use atom: for absolute paths to avoid triple slashes
            if (thumbnailPath.startsWith('/')) {
              convertedImage.thumbnails[key as keyof typeof convertedImage.thumbnails] = `atom:${thumbnailPath}`;
            } else {
              convertedImage.thumbnails[key as keyof typeof convertedImage.thumbnails] = `atom://${thumbnailPath}`;
            }
          }
        });
      }

      return convertedImage;
    });
  }

  /**
   * Handle Go daemon commands
   */
  private async handleGoDaemonCommand(action: string, payload?: unknown): Promise<any> {
    try {
      switch (action) {
        // Playlist operations
        case 'start_playlist':
          return await goDaemonClient.sendCommand('start_playlist', payload);
        case 'stop_playlist':
          return await goDaemonClient.sendCommand('stop_playlist', payload);
        case 'pause_playlist':
          return await goDaemonClient.sendCommand('pause_playlist', payload);
        case 'resume_playlist':
          return await goDaemonClient.sendCommand('resume_playlist', payload);
        case 'save_playlist':
          return await goDaemonClient.savePlaylist((payload as any)?.playlist);
        case 'delete_playlist':
          return await goDaemonClient.deletePlaylist((payload as any)?.playlistName);
        case 'get_active_playlist':
          return await goDaemonClient.getActivePlaylist((payload as any)?.activeMonitor);
        case 'get_active_playlists':
          return await goDaemonClient.getActivePlaylists();
        case 'get_playlist_images':
          return await goDaemonClient.getPlaylistImages((payload as any)?.playlistId);
        
        // Image navigation
        case 'next_image':
          return await goDaemonClient.sendCommand('next_image', payload);
        case 'previous_image':
          return await goDaemonClient.sendCommand('previous_image', payload);
        case 'random_image':
          return await goDaemonClient.sendCommand('random_image', payload);
        case 'set_image':
          return await goDaemonClient.sendCommand('set_image', payload);
        
        // Multi-monitor operations
        case 'set_image_across_monitors':
          return await goDaemonClient.setImageAcrossMonitors(
            (payload as any)?.image?.id,
            (payload as any)?.activeMonitor
          );
        case 'duplicate_image_across_monitors':
          return await goDaemonClient.duplicateImageAcrossMonitors(
            (payload as any)?.image?.id,
            (payload as any)?.activeMonitor
          );
        case 'process_for_monitors':
          return await goDaemonClient.processForMonitors(
            (payload as any)?.image?.id,
            (payload as any)?.activeMonitor
          );
        
        // Data queries
        case 'get_images':
          const images = await goDaemonClient.getImages(payload);
          console.log('🔍 IPC Manager: Raw images from daemon:', images);
          // Convert all paths to atom:// protocol for frontend consumption
          return this.convertPathsToAtomProtocol(images);
        case 'get_playlists':
          return await goDaemonClient.getPlaylists();
        case 'get_monitors':
          return await goDaemonClient.getMonitors();
        case 'get_info':
          return await goDaemonClient.sendCommand('get_info', {});
        case 'get_image_history':
          return await goDaemonClient.getImageHistory();
        case 'delete_image_from_gallery':
          return await goDaemonClient.deleteImagesFromGallery((payload as any)?.imageIds);
        case 'get_diagnostics':
          return await goDaemonClient.getDiagnostics((payload as any)?.monitorName);
        
        // Image processing
        case 'process_images':
          return await goDaemonClient.processImages(
            (payload as any)?.imagePaths || [],
            (payload as any)?.fileNames || []
          );
        
        // Configuration
        case 'get_config':
          return await goDaemonClient.getConfig();
        case 'set_config':
          return await goDaemonClient.setConfig(
            (payload as any)?.config?.configSection || '',
            (payload as any)?.config?.configKey || '',
            (payload as any)?.config?.configValue
          );
        case 'get_app_config':
          return await goDaemonClient.getAppConfig();
        case 'set_app_config':
          return await goDaemonClient.setAppConfig(
            (payload as any)?.key || '',
            (payload as any)?.value
          );
        case 'get_swww_config':
          return await goDaemonClient.getSwwwConfig();
        case 'set_swww_config':
          return await goDaemonClient.setSwwwConfig(payload as any);
        case 'get_frontend_config':
          return await goDaemonClient.sendCommand('get_frontend_config', {});
        case 'set_frontend_config':
          return await goDaemonClient.sendCommand('set_frontend_config', payload);
        case 'restore_last_wallpapers':
          return await goDaemonClient.sendCommand('restore_last_wallpapers', {});
        
        // Monitor operations
        case 'set_selected_monitor':
          return await goDaemonClient.setSelectedMonitor((payload as any)?.activeMonitor);
        case 'get_selected_monitor':
          return await goDaemonClient.getSelectedMonitor();
        
        // System
        case 'ping':
          return await goDaemonClient.ping();
        case 'get_daemon_status':
          return await goDaemonClient.getDaemonStatus();
        case 'stop_daemon':
          return await goDaemonClient.stopDaemon();
        
        default:
          throw new Error(`Unknown Go daemon action: ${action}`);
      }
    } catch (error) {
      console.error(`Go daemon command failed: ${action}`, error);
      throw error;
    }
  }

  /**
   * Setup Go daemon event forwarding to renderer processes
   */
  private setupGoDaemonEventForwarding(): void {
    // Listen for all events from the Go daemon client
    goDaemonClient.on('playlist_updated', (data) => {
      this.broadcastToAllWindows('go-daemon-event-playlist_updated', data);
    });
    
    goDaemonClient.on('config_changed', (data) => {
      this.broadcastToAllWindows('go-daemon-event-config_changed', data);
    });
    
    goDaemonClient.on('images_updated', (data) => {
      this.broadcastToAllWindows('go-daemon-event-images_updated', data);
    });
    
    goDaemonClient.on('image_processed', (data) => {
      this.broadcastToAllWindows('go-daemon-event-image_processed', data);
    });
    
    goDaemonClient.on('image_error', (data) => {
      this.broadcastToAllWindows('go-daemon-event-image_error', data);
    });
    
    goDaemonClient.on('processing_complete', (data) => {
      this.broadcastToAllWindows('go-daemon-event-processing_complete', data);
    });
    
    goDaemonClient.on('processing_started', (data) => {
      this.broadcastToAllWindows('go-daemon-event-processing_started', data);
    });
    
    goDaemonClient.on('image_progress', (data) => {
      this.broadcastToAllWindows('go-daemon-event-image_progress', data);
    });
    
    goDaemonClient.on('thumbnail_created', (data) => {
      this.broadcastToAllWindows('go-daemon-event-thumbnail_created', data);
    });
    
    goDaemonClient.on('displays_changed', (data) => {
      this.broadcastToAllWindows('go-daemon-event-displays_changed', data);
    });
    
    // Context menu events
    goDaemonClient.on('clear_selection', (data) => {
      this.broadcastToAllWindows('go-daemon-event-clear_selection', data);
    });
    
    goDaemonClient.on('set_images_per_page', (data) => {
      this.broadcastToAllWindows('go-daemon-event-set_images_per_page', data);
    });
    
    goDaemonClient.on('select_all_images_in_gallery', (data) => {
      this.broadcastToAllWindows('go-daemon-event-select_all_images_in_gallery', data);
    });
    
    goDaemonClient.on('select_all_images_in_current_page', (data) => {
      this.broadcastToAllWindows('go-daemon-event-select_all_images_in_current_page', data);
    });
    
    goDaemonClient.on('clear_selection_on_current_page', (data) => {
      this.broadcastToAllWindows('go-daemon-event-clear_selection_on_current_page', data);
    });
    
    goDaemonClient.on('remove_selected_images_from_playlist', (data) => {
      this.broadcastToAllWindows('go-daemon-event-remove_selected_images_from_playlist', data);
    });
    
    goDaemonClient.on('delete_all_selected_images', (data) => {
      this.broadcastToAllWindows('go-daemon-event-delete_all_selected_images', data);
    });
    
    goDaemonClient.on('add_selected_images_to_playlist', (data) => {
      this.broadcastToAllWindows('go-daemon-event-add_selected_images_to_playlist', data);
    });
    
    goDaemonClient.on('delete_image_from_gallery', (data) => {
      this.broadcastToAllWindows('go-daemon-event-delete_image_from_gallery', data);
    });
    
    goDaemonClient.on('clear_playlist', (data) => {
      this.broadcastToAllWindows('go-daemon-event-clear_playlist', data);
    });
    
    console.log('Go daemon event forwarding setup complete');
  }

  /**
   * Broadcast message to all windows
   */
  private broadcastToAllWindows(channel: string, data: any): void {
    this.windows.forEach(window => {
      if (!window.isDestroyed()) {
        window.webContents.send(channel, data);
      }
    });
  }

  /**
   * Get all registered handlers
   */
  getAllHandlers(): IPCHandler[] {
    return Array.from(this.handlers.values());
  }

  /**
   * Get handler count
   */
  getHandlerCount(): number {
    return this.handlers.size;
  }

  /**
   * Handle clean application exit
   */
  private async handleExitApp(): Promise<boolean> {
    try {
      console.log('🔄 IPCManager: Handling clean application exit...');
      
      // Get the current configuration to check if we should stop the daemon
      const config = await goDaemonClient.getConfig();
      const shouldStopDaemon = config?.app?.kill_daemon_on_exit ?? false;
      
      if (shouldStopDaemon) {
        console.log('🔄 IPCManager: Stopping daemon on exit...');
        await goDaemonClient.stopDaemon();
        console.log('✅ IPCManager: Daemon stopped successfully');
      } else {
        console.log('ℹ️ IPCManager: Keeping daemon running on exit');
      }
      
      // Close all windows gracefully
      console.log('🔄 IPCManager: Closing all windows...');
      this.windows.forEach(window => {
        if (!window.isDestroyed()) {
          window.close();
        }
      });
      
      // Quit the application
      console.log('🔄 IPCManager: Quitting application...');
      app.quit();
      
      return true;
    } catch (error) {
      console.error('❌ IPCManager: Error during application exit:', error);
      
      // Force quit even if there's an error
      console.log('🔄 IPCManager: Force quitting application...');
      app.quit();
      
      return false;
    }
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    this.handlers.forEach((_handler, channel) => {
      ipcMain.removeHandler(channel);
    });
    this.handlers.clear();
    this.windows.clear();
    this.isInitialized = false;
    console.log('IPC Manager cleaned up');
  }
}

export default IPCManager;
