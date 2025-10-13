import type { JsonStoreImage, DaemonPlaylist, DaemonAppConfig, DaemonSwwwConfig, DaemonMonitor } from '../shared/types/daemon';
import type { ActiveMonitor } from '../shared/types/monitor';
import type { UnifiedConfig, ConfigChangeEvent } from '../shared/types/unifiedConfig';

declare global {
  interface Window {
    API_RENDERER: {
      goDaemon: {
        // Unified configuration
        getConfig: () => Promise<UnifiedConfig>;
        setConfig: (section: string, key: string, value: unknown) => Promise<boolean>;
        
        // Event listening
        onConfigChanged: (callback: (data: ConfigChangeEvent) => void) => void;
        offConfigChanged: (callback: (data: ConfigChangeEvent) => void) => void;
        
        // Legacy configuration (keep for backward compatibility)
        getAppConfig: () => Promise<DaemonAppConfig>;
        setAppConfig: (key: string, value: unknown) => Promise<boolean>;
        
        // Other methods
        on: (event: string, callback: (data: unknown) => void) => void;
        off: (event: string, callback: (data: unknown) => void) => void;
        processImages: (imagePaths: string[], fileNames: string[]) => Promise<boolean>;
        getImages: (filters?: unknown) => Promise<JsonStoreImage[]>;
        getPlaylists: () => Promise<DaemonPlaylist[]>;
        getMonitors: () => Promise<DaemonMonitor[]>;
        stopDaemon: () => Promise<boolean>;
        // Add other methods as needed
      };
      // File operations
      openFiles: (action: string) => Promise<{ success: boolean; files: string[]; error?: string }>;
      handleOpenImages: (imagesObject: unknown) => Promise<{ success: boolean; message?: string; error?: string }>;
      // Application control
      exitApp: () => Promise<boolean>;
      // Daemon management
      getDaemonStatus: () => Promise<{ isRunning: boolean; lastChecked: number; lastError?: string; uptime?: number; version?: string }>;
      restartDaemon: () => Promise<{ success: boolean; error?: string }>;
      startDaemon: () => Promise<{ success: boolean; error?: string }>;
      stopDaemon: () => Promise<{ success: boolean; error?: string }>;
      // Event listeners
      onAppError: (callback: (error: any) => void) => void;
      onDaemonStatusUpdate: (callback: (data: any) => void) => void;
      offDaemonStatusUpdate: (callback: (data: any) => void) => void;
      removeAllListeners: (channel: string) => void;
      // Add other API methods as needed
    };
  }
}

export {};
