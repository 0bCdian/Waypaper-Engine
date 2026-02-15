import type {
	ActiveMonitor,
	MonitorSelection,
	Monitor,
} from "../shared/types/monitor";
import type {
	RendererPlaylist,
	StoredPlaylist,
	RunningPlaylistInfo,
	ImageHistory,
	ImageInfo,
	UnifiedConfig,
	DaemonStatus,
	DaemonInfo,
	PlaylistDiagnostics,
	EventType,
} from "../../electron/daemon-go-types";
import type { JsonStoreImage } from "../shared/types/daemon";
import type { ConfigChangeEvent } from "../shared/types/unifiedConfig";

declare global {
	interface Window {
		API_RENDERER: {
			goDaemon: {
				// ----------------------------------------------------------------------------
				// SYSTEM OPERATIONS
				// ----------------------------------------------------------------------------
				ping: () => Promise<boolean>;
				getInfo: () => Promise<DaemonInfo>;
				getMonitors: () => Promise<Monitor[]>;
				getDaemonStatus: () => Promise<DaemonStatus>;
				getDiagnostics: (monitorName?: string) => Promise<PlaylistDiagnostics>;
				killDaemon: () => Promise<void>;
				stopDaemon: () => Promise<void>;

				// ----------------------------------------------------------------------------
				// PLAYLIST OPERATIONS
				// ----------------------------------------------------------------------------
				getPlaylists: () => Promise<StoredPlaylist[]>;
				getPlaylist: (playlistId: number) => Promise<StoredPlaylist>;
				savePlaylist: (playlist: RendererPlaylist) => Promise<StoredPlaylist>;
				deletePlaylist: (playlistName: string) => Promise<void>;
				startPlaylist: (
					playlistId: number,
					activeMonitor: ActiveMonitor | MonitorSelection,
				) => Promise<void>;
				stopPlaylist: (
					activeMonitor: ActiveMonitor | MonitorSelection,
				) => Promise<void>;
				pausePlaylist: (
					activeMonitor: ActiveMonitor | MonitorSelection,
				) => Promise<void>;
				resumePlaylist: (
					activeMonitor: ActiveMonitor | MonitorSelection,
				) => Promise<void>;
				nextPlaylistImage: (
					activeMonitor: ActiveMonitor | MonitorSelection,
				) => Promise<void>;
				previousPlaylistImage: (
					activeMonitor: ActiveMonitor | MonitorSelection,
				) => Promise<void>;
				getRunningPlaylists: () => Promise<Record<string, RunningPlaylistInfo>>;

				// ----------------------------------------------------------------------------
				// IMAGE OPERATIONS
				// ----------------------------------------------------------------------------
				getImages: (filters?: unknown) => Promise<JsonStoreImage[]>;
				processImages: (
					imagePaths: string[],
					fileNames: string[],
				) => Promise<void>;
				deleteImages: (imageIds: number[]) => Promise<void>;
				upsertImage: (image: ImageInfo) => Promise<void>;
				getImageHistory: () => Promise<ImageHistory[]>;
				processForMonitors: (
					imageId: number,
					activeMonitor: ActiveMonitor | MonitorSelection,
				) => Promise<Record<string, string>>;

				// ----------------------------------------------------------------------------
				// CONFIGURATION OPERATIONS
				// ----------------------------------------------------------------------------
				getConfig: () => Promise<UnifiedConfig>;
				setConfig: (
					section: string,
					key: string,
					value: unknown,
				) => Promise<void>;
				setBulkConfig: (config: Partial<UnifiedConfig>) => Promise<void>;
				setSelectedMonitor: (
					activeMonitor: ActiveMonitor | MonitorSelection,
				) => Promise<void>;
				getSelectedMonitor: () => Promise<MonitorSelection>;

				// ----------------------------------------------------------------------------
				// MISCELLANEOUS OPERATIONS
				// ----------------------------------------------------------------------------
				setImage: (
					imageId: number,
					imageName: string,
					activeMonitor: ActiveMonitor | MonitorSelection | string,
				) => Promise<void>;
				setImageAcrossMonitors: (
					imageId: number,
					imageName: string,
					activeMonitor: ActiveMonitor | MonitorSelection,
				) => Promise<void>;
				nextImageHistory: (
					activeMonitor: ActiveMonitor | MonitorSelection,
				) => Promise<void>;
				previousImageHistory: (
					activeMonitor: ActiveMonitor | MonitorSelection,
				) => Promise<void>;
				randomImage: (
					activeMonitor: ActiveMonitor | MonitorSelection,
				) => Promise<void>;

				// ----------------------------------------------------------------------------
				// EVENT SUBSCRIPTION
				// ----------------------------------------------------------------------------
				subscribeToEvents: (
					eventTypes: Array<EventType | "*">,
				) => Promise<void>;
				unsubscribeFromEvents: (
					eventTypes: Array<EventType | "*">,
				) => Promise<void>;
				on: (event: EventType, callback: (data: unknown) => void) => void;
				off: (event: EventType, callback: (data: unknown) => void) => void;

				// ----------------------------------------------------------------------------
				// LEGACY COMPATIBILITY METHODS
				// ----------------------------------------------------------------------------
				/** @deprecated Use deleteImages instead */
				deleteImagesFromGallery: (imageIds: number[]) => Promise<void>;
				/** @deprecated Use nextPlaylistImage instead */
				nextImage: (
					activeMonitor: ActiveMonitor | MonitorSelection,
				) => Promise<void>;
				/** @deprecated Use previousPlaylistImage instead */
				previousImage: (
					activeMonitor: ActiveMonitor | MonitorSelection,
				) => Promise<void>;
				/** @deprecated Use getRunningPlaylists instead */
				getActivePlaylist: (
					activeMonitor: ActiveMonitor | MonitorSelection,
				) => Promise<RunningPlaylistInfo | null>;
				/** @deprecated Use getPlaylist instead */
				getPlaylistImages: (playlistId: number) => Promise<StoredPlaylist>;
				/** @deprecated Use setImageAcrossMonitors with mode: "clone" */
				duplicateImageAcrossMonitors: (
					imageId: number,
					activeMonitor: ActiveMonitor | MonitorSelection,
				) => Promise<void>;
				/** @deprecated Use getConfig instead */
				getAppConfig: () => Promise<UnifiedConfig>;
				/** @deprecated Use setBulkConfig instead */
				setAppConfig: (config: Partial<UnifiedConfig>) => Promise<void>;
				/** @deprecated Use getConfig instead */
				getSwwwConfig: () => Promise<UnifiedConfig["backend"]["swww"]>;
				/** @deprecated Use setBulkConfig instead */
				setSwwwConfig: (
					swwwConfig: UnifiedConfig["backend"]["swww"],
				) => Promise<void>;
				/** @deprecated Legacy event listener - use on() instead */
				onConfigChanged: (callback: (data: unknown) => void) => void;
				/** @deprecated Legacy event listener - use off() instead */
				offConfigChanged: (callback: (data: unknown) => void) => void;
				/** @deprecated Use setBulkConfig instead */
				setPartialConfig: (config: Partial<UnifiedConfig>) => Promise<void>;
			};

			// ============================================================================
			// THEME MANAGEMENT
			// ============================================================================
			getNativeTheme: () => Promise<unknown>;
			setThemeSource: (source: "system" | "light" | "dark") => Promise<void>;
			onNativeThemeUpdated: (callback: (themeInfo: unknown) => void) => void;
			onThemeChanged: (callback: (data: unknown) => void) => void;

			// ============================================================================
			// SYSTEM INFO
			// ============================================================================
			getAppInfo: () => Promise<unknown>;
			ping: () => Promise<unknown>;

			// ============================================================================
			// WINDOW MANAGEMENT
			// ============================================================================
			getWindowBounds: () => Promise<Electron.Rectangle>;
			setWindowBounds: (bounds: Electron.Rectangle) => Promise<void>;
			minimizeWindow: () => Promise<void>;
			maximizeWindow: () => Promise<void>;
			closeWindow: () => Promise<void>;
			hideWindow: () => Promise<void>;
			showWindow: () => Promise<void>;

			// ============================================================================
			// APPLICATION CONTROL
			// ============================================================================
			exitApp: () => Promise<void>;

			// ============================================================================
			// DAEMON MANAGEMENT
			// ============================================================================
			getDaemonStatus: () => Promise<unknown>;
			restartDaemon: () => Promise<unknown>;
			startDaemon: () => Promise<unknown>;
			stopDaemon: () => Promise<unknown>;

			// ============================================================================
			// EVENT LISTENERS
			// ============================================================================
			onAppError: (callback: (error: unknown) => void) => void;
			onDaemonStatusUpdate: (callback: (data: unknown) => void) => void;
			offDaemonStatusUpdate: (callback: (data: unknown) => void) => void;
			removeAllListeners: (channel: string) => void;

			// ============================================================================
			// FILE OPERATIONS
			// ============================================================================
			openFiles: (
				action: "file" | "folder",
			) => Promise<{ success: boolean; data?: { files: string[] }; files?: string[]; error?: string }>;
			handleOpenImages: (imagesObject: {
				success: boolean;
				data: { files: string[] };
			}) => Promise<{ success: boolean; message?: string; error?: string }>;
			openContextMenu: (options: {
				Image?: unknown;
				selectedImagesLength: number;
			}) => Promise<{ success: boolean; error?: string }>;
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
