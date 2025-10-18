import type {
	JsonStoreImage,
	DaemonPlaylist,
	DaemonAppConfig,
	DaemonSwwwConfig,
	DaemonMonitor,
} from "../shared/types/daemon";
import type { ActiveMonitor } from "../shared/types/monitor";
import type {
	UnifiedConfig,
	ConfigChangeEvent,
} from "../shared/types/unifiedConfig";

declare global {
	interface Window {
		API_RENDERER: {
			goDaemon: {
				// Unified configuration
				getConfig: () => Promise<UnifiedConfig>;
				setConfig: (
					section: string,
					key: string,
					value: unknown,
				) => Promise<boolean>;

				// Event listening
				onConfigChanged: (callback: (data: ConfigChangeEvent) => void) => void;
				offConfigChanged: (callback: (data: ConfigChangeEvent) => void) => void;

				// Legacy configuration (keep for backward compatibility)
				getAppConfig: () => Promise<DaemonAppConfig>;
				setAppConfig: (key: string, value: unknown) => Promise<boolean>;

				// Other methods
				on: (event: string, callback: (data: unknown) => void) => void;
				off: (event: string, callback: (data: unknown) => void) => void;
				processImages: (
					imagePaths: string[],
					fileNames: string[],
				) => Promise<boolean>;
				getImages: (filters?: unknown) => Promise<JsonStoreImage[]>;
				getPlaylists: () => Promise<DaemonPlaylist[]>;
				getPlaylistImages: (playlistId: number) => Promise<{ id: number; name: string; width: number; height: number; format: string }[]>;
				getActivePlaylist: (activeMonitor: ActiveMonitor) => Promise<{ images: { id: number; name: string; width: number; height: number; format: string }[]; type: string; name: string; order: string; interval: number | null; showAnimations: boolean; alwaysStartOnFirstImage: boolean } | null>;
				savePlaylist: (playlist: unknown) => Promise<boolean>;
				deletePlaylist: (playlistName: string) => Promise<boolean>;
				startPlaylist: (playlistName: string, activeMonitor: ActiveMonitor) => Promise<boolean>;
				getImageSrc: (imageId: number) => Promise<string>;
				getThumbnailSrc: (imageId: number) => Promise<string>;
				getMonitorImage: (monitorName: string) => Promise<string>;
				setImageAcrossMonitors: (imageId: number, activeMonitor: ActiveMonitor) => Promise<boolean>;
				setImage: (imageId: number, monitorName: string) => Promise<boolean>;
				openContextMenu: (x: number, y: number, imageId?: number) => Promise<void>;
				updateTray: () => Promise<void>;
				randomImage: (activeMonitor: ActiveMonitor) => Promise<boolean>;
				setSelectedMonitor: (activeMonitor: ActiveMonitor) => Promise<boolean>;
				getSwwwConfig: () => Promise<DaemonSwwwConfig>;
				setSwwwConfig: (config: DaemonSwwwConfig) => Promise<boolean>;
				getDaemonStatus: () => Promise<unknown>;
				deleteImagesFromGallery: (imageIds: number[]) => Promise<boolean>;
				testConnection: () => Promise<boolean>;
				setPartialConfig: (config: unknown) => Promise<boolean>;
				setFrontendConfig: (config: unknown) => Promise<boolean>;
				getFrontendConfig: () => Promise<unknown>;
				getMonitors: () => Promise<DaemonMonitor[]>;
				stopDaemon: () => Promise<boolean>;
				// Add other methods as needed
			};
			// File operations
			openFiles: (
				action: string,
			) => Promise<{ success: boolean; files: string[]; error?: string }>;
			handleOpenImages: (
				imagesObject: unknown,
			) => Promise<{ success: boolean; message?: string; error?: string }>;
			// Application control
			exitApp: () => Promise<boolean>;
			// Daemon management
			getDaemonStatus: () => Promise<{
				isRunning: boolean;
				lastChecked: number;
				lastError?: string;
				uptime?: number;
				version?: string;
			}>;
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
		// Modal controls
		monitors?: {
			showModal: () => void;
			closeModal: () => void;
			close: () => void;
		};
	}
}

export {};
