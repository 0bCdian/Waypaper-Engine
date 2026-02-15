/**
 * Preload Script for Waypaper Engine
 *
 * Exposes safe APIs to the renderer process via contextBridge.
 * Updated for Go Daemon v2.0.0 API
 */

import { contextBridge, ipcRenderer } from "electron";
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
} from "./daemon-go-types";
import type { JsonStoreImage } from "../shared/types/daemon";

// Type for configuration payloads
interface ConfigPayload {
	configSection?: string;
	configKey?: string;
	configValue?: unknown;
	frontendConfig?: Partial<UnifiedConfig>;
}

// Create the API object
const electronAPI = {
	// ============================================================================
	// GO DAEMON API
	// ============================================================================
	goDaemon: {
		// ----------------------------------------------------------------------------
		// SYSTEM OPERATIONS
		// ----------------------------------------------------------------------------
		ping: (): Promise<boolean> =>
			ipcRenderer.invoke("go-daemon-command", "ping"),

		getInfo: (): Promise<DaemonInfo> =>
			ipcRenderer.invoke("go-daemon-command", "get_info"),

		getMonitors: (): Promise<Monitor[]> =>
			ipcRenderer.invoke("go-daemon-command", "get_monitors"),

		getDaemonStatus: (): Promise<DaemonStatus> =>
			ipcRenderer.invoke("go-daemon-command", "get_daemon_status"),

		getDiagnostics: (monitorName?: string): Promise<PlaylistDiagnostics> =>
			ipcRenderer.invoke("go-daemon-command", "get_diagnostics", {
				monitorName,
			}),

		killDaemon: (): Promise<void> =>
			ipcRenderer.invoke("go-daemon-command", "kill_daemon"),

		stopDaemon: (): Promise<void> =>
			ipcRenderer.invoke("go-daemon-command", "stop_daemon"),

		// ----------------------------------------------------------------------------
		// PLAYLIST OPERATIONS
		// ----------------------------------------------------------------------------
		getPlaylists: (): Promise<StoredPlaylist[]> =>
			ipcRenderer.invoke("go-daemon-command", "get_playlists"),

		getPlaylist: (playlistId: number): Promise<StoredPlaylist> =>
			ipcRenderer.invoke("go-daemon-command", "get_playlist", {
				playlistId,
			}),

		savePlaylist: (playlist: RendererPlaylist): Promise<StoredPlaylist> =>
			ipcRenderer.invoke("go-daemon-command", "upsert_playlist", {
				playlist,
			}),

		deletePlaylist: (playlistName: string): Promise<void> =>
			ipcRenderer.invoke("go-daemon-command", "delete_playlist", {
				playlistName,
			}),

		startPlaylist: (
			playlistId: number,
			activeMonitor: ActiveMonitor | MonitorSelection,
		): Promise<void> =>
			ipcRenderer.invoke("go-daemon-command", "start_playlist", {
				playlistId,
				activeMonitor,
			}),

		stopPlaylist: (
			activeMonitor: ActiveMonitor | MonitorSelection,
		): Promise<void> =>
			ipcRenderer.invoke("go-daemon-command", "stop_playlist", {
				activeMonitor,
			}),

		pausePlaylist: (
			activeMonitor: ActiveMonitor | MonitorSelection,
		): Promise<void> =>
			ipcRenderer.invoke("go-daemon-command", "pause_playlist", {
				activeMonitor,
			}),

		resumePlaylist: (
			activeMonitor: ActiveMonitor | MonitorSelection,
		): Promise<void> =>
			ipcRenderer.invoke("go-daemon-command", "resume_playlist", {
				activeMonitor,
			}),

		nextPlaylistImage: (
			activeMonitor: ActiveMonitor | MonitorSelection,
		): Promise<void> =>
			ipcRenderer.invoke("go-daemon-command", "next_playlist_image", {
				activeMonitor,
			}),

		previousPlaylistImage: (
			activeMonitor: ActiveMonitor | MonitorSelection,
		): Promise<void> =>
			ipcRenderer.invoke("go-daemon-command", "previous_playlist_image", {
				activeMonitor,
			}),

		getRunningPlaylists: (): Promise<Record<string, RunningPlaylistInfo>> =>
			ipcRenderer.invoke("go-daemon-command", "get_running_playlists"),

		// ----------------------------------------------------------------------------
		// IMAGE OPERATIONS
		// ----------------------------------------------------------------------------
		getImages: (filters?: unknown): Promise<JsonStoreImage[]> =>
			ipcRenderer.invoke("go-daemon-command", "get_images", { filters }),

		processImages: (
			imagePaths: string[],
			fileNames: string[],
		): Promise<void> =>
			ipcRenderer.invoke("go-daemon-command", "process_images", {
				imagePaths,
				fileNames,
			}),

		deleteImages: (imageIds: number[]): Promise<void> =>
			ipcRenderer.invoke("go-daemon-command", "delete_images", { imageIds }),

		upsertImage: (image: ImageInfo): Promise<void> =>
			ipcRenderer.invoke("go-daemon-command", "upsert_image", { image }),

		getImageHistory: (): Promise<ImageHistory[]> =>
			ipcRenderer.invoke("go-daemon-command", "get_image_history"),

		processForMonitors: (
			imageId: number,
			activeMonitor: ActiveMonitor | MonitorSelection,
		): Promise<Record<string, string>> =>
			ipcRenderer.invoke("go-daemon-command", "process_for_monitors", {
				image: { id: imageId },
				activeMonitor,
			}),

		// ----------------------------------------------------------------------------
		// CONFIGURATION OPERATIONS
		// ----------------------------------------------------------------------------
		getConfig: (): Promise<UnifiedConfig> =>
			ipcRenderer.invoke("go-daemon-command", "get_config"),

		setConfig: (section: string, key: string, value: unknown): Promise<void> =>
			ipcRenderer.invoke("go-daemon-command", "upsert_config", {
				config: {
					configSection: section,
					configKey: key,
					configValue: value,
				} as ConfigPayload,
			}),

		setBulkConfig: (config: Partial<UnifiedConfig>): Promise<void> =>
			ipcRenderer.invoke("go-daemon-command", "upsert_config", {
				config: {
					frontendConfig: config,
				} as ConfigPayload,
			}),

		setSelectedMonitor: (
			activeMonitor: ActiveMonitor | MonitorSelection,
		): Promise<void> =>
			ipcRenderer.invoke("go-daemon-command", "set_selected_monitor", {
				activeMonitor,
			}),

		getSelectedMonitor: (): Promise<MonitorSelection> =>
			ipcRenderer.invoke("go-daemon-command", "get_selected_monitor"),

		// ----------------------------------------------------------------------------
		// MISCELLANEOUS OPERATIONS
		// ----------------------------------------------------------------------------
		setImage: (
			imageId: number,
			imageName: string,
			activeMonitor: ActiveMonitor | MonitorSelection | string,
		): Promise<void> =>
			ipcRenderer.invoke("go-daemon-command", "set_image", {
				image: { id: imageId, name: imageName },
				activeMonitor,
			}),

		setImageAcrossMonitors: (
			imageId: number,
			imageName: string,
			activeMonitor: ActiveMonitor | MonitorSelection,
		): Promise<void> =>
			ipcRenderer.invoke("go-daemon-command", "set_image_across_monitors", {
				image: { id: imageId, name: imageName },
				activeMonitor,
			}),

		nextImageHistory: (
			activeMonitor: ActiveMonitor | MonitorSelection,
		): Promise<void> =>
			ipcRenderer.invoke("go-daemon-command", "next_image_history", {
				activeMonitor,
			}),

		previousImageHistory: (
			activeMonitor: ActiveMonitor | MonitorSelection,
		): Promise<void> =>
			ipcRenderer.invoke("go-daemon-command", "previous_image_history", {
				activeMonitor,
			}),

		randomImage: (
			activeMonitor: ActiveMonitor | MonitorSelection,
		): Promise<void> =>
			ipcRenderer.invoke("go-daemon-command", "random_image", {
				activeMonitor,
			}),

		// ----------------------------------------------------------------------------
		// EVENT SUBSCRIPTION
		// ----------------------------------------------------------------------------
		subscribeToEvents: (eventTypes: Array<EventType | "*">): Promise<void> =>
			ipcRenderer.invoke("go-daemon-command", "subscribe", { eventTypes }),

		unsubscribeFromEvents: (
			eventTypes: Array<EventType | "*">,
		): Promise<void> =>
			ipcRenderer.invoke("go-daemon-command", "unsubscribe", { eventTypes }),

		// Event listeners
		on: (event: EventType, callback: (data: unknown) => void): void => {
			ipcRenderer.on(`go-daemon-event-${event}`, (_, data) => callback(data));
		},

		off: (event: EventType, callback: (data: unknown) => void): void => {
			ipcRenderer.off(`go-daemon-event-${event}`, callback);
		},

		// ----------------------------------------------------------------------------
		// LEGACY COMPATIBILITY METHODS
		// ----------------------------------------------------------------------------

		/** @deprecated Use deleteImages instead */
		deleteImagesFromGallery: (imageIds: number[]): Promise<void> =>
			ipcRenderer.invoke("go-daemon-command", "delete_images", { imageIds }),

		/** @deprecated Use nextPlaylistImage instead */
		nextImage: (activeMonitor: ActiveMonitor | MonitorSelection): Promise<void> =>
			ipcRenderer.invoke("go-daemon-command", "next_playlist_image", {
				activeMonitor,
			}),

		/** @deprecated Use previousPlaylistImage instead */
		previousImage: (
			activeMonitor: ActiveMonitor | MonitorSelection,
		): Promise<void> =>
			ipcRenderer.invoke("go-daemon-command", "previous_playlist_image", {
				activeMonitor,
			}),

		/** @deprecated Use getRunningPlaylists instead */
		getActivePlaylist: (
			activeMonitor: ActiveMonitor | MonitorSelection,
		): Promise<RunningPlaylistInfo | null> =>
			ipcRenderer.invoke("go-daemon-command", "get_running_playlists", {
				activeMonitor,
			}),

		/** @deprecated Use getPlaylist instead */
		getPlaylistImages: (playlistId: number): Promise<StoredPlaylist> =>
			ipcRenderer.invoke("go-daemon-command", "get_playlist", {
				playlistId,
			}),

		/** @deprecated Use setImageAcrossMonitors with mode: "clone" */
		duplicateImageAcrossMonitors: (
			imageId: number,
			activeMonitor: ActiveMonitor | MonitorSelection,
		): Promise<void> =>
			ipcRenderer.invoke(
				"go-daemon-command",
				"duplicate_image_across_monitors",
				{
					image: { id: imageId },
					activeMonitor,
				},
			),

		/** @deprecated Use getConfig instead */
		getAppConfig: (): Promise<UnifiedConfig> =>
			ipcRenderer.invoke("go-daemon-command", "get_config"),

		/** @deprecated Use setBulkConfig instead */
		setAppConfig: (config: Partial<UnifiedConfig>): Promise<void> =>
			ipcRenderer.invoke("go-daemon-command", "upsert_config", {
				config: { frontendConfig: config } as ConfigPayload,
			}),

		/** @deprecated Use getConfig instead */
		getSwwwConfig: async (): Promise<UnifiedConfig["backend"]["swww"]> => {
			const config = await ipcRenderer.invoke("go-daemon-command", "get_config");
			return config.backend.swww;
		},

		/** @deprecated Use setBulkConfig instead */
		setSwwwConfig: (
			swwwConfig: UnifiedConfig["backend"]["swww"],
		): Promise<void> =>
			ipcRenderer.invoke("go-daemon-command", "upsert_config", {
				config: {
					frontendConfig: {
						backend: {
							type: "swww" as const,
							swww: swwwConfig,
						},
					},
				} as ConfigPayload,
			}),

		/** @deprecated Legacy event listener - use on() instead */
		onConfigChanged: (callback: (data: unknown) => void): void => {
			ipcRenderer.on("go-daemon-event-config_changed", (_, data) =>
				callback(data),
			);
		},

		/** @deprecated Legacy event listener - use off() instead */
		offConfigChanged: (callback: (data: unknown) => void): void => {
			ipcRenderer.off("go-daemon-event-config_changed", callback);
		},

		/** @deprecated Use setBulkConfig instead */
		setPartialConfig: (
			partialConfig: Partial<UnifiedConfig>,
		): Promise<void> =>
			ipcRenderer.invoke("go-daemon-command", "upsert_config", {
				config: {
					frontendConfig: partialConfig,
				} as ConfigPayload,
			}),
	},

	// ============================================================================
	// THEME MANAGEMENT
	// ============================================================================
	getNativeTheme: () => ipcRenderer.invoke("get-native-theme"),

	setThemeSource: (source: "system" | "light" | "dark") =>
		ipcRenderer.invoke("set-theme-source", source),

	onNativeThemeUpdated: (callback: (themeInfo: unknown) => void) => {
		ipcRenderer.on("native-theme-updated", (_, themeInfo) =>
			callback(themeInfo),
		);
	},

	onThemeChanged: (callback: (data: unknown) => void) => {
		ipcRenderer.on("theme-changed", (_, data) => callback(data));
	},

	// ============================================================================
	// SYSTEM INFO
	// ============================================================================
	getAppInfo: () => ipcRenderer.invoke("get-app-info"),
	ping: () => ipcRenderer.invoke("ping"),

	// ============================================================================
	// WINDOW MANAGEMENT
	// ============================================================================
	getWindowBounds: () => ipcRenderer.invoke("get-window-bounds"),
	setWindowBounds: (bounds: Electron.Rectangle) =>
		ipcRenderer.invoke("set-window-bounds", bounds),
	minimizeWindow: () => ipcRenderer.invoke("minimize-window"),
	maximizeWindow: () => ipcRenderer.invoke("maximize-window"),
	closeWindow: () => ipcRenderer.invoke("close-window"),
	hideWindow: () => ipcRenderer.invoke("hide-window"),
	showWindow: () => ipcRenderer.invoke("show-window"),

	// ============================================================================
	// APPLICATION CONTROL
	// ============================================================================
	exitApp: () => ipcRenderer.invoke("exit-app"),

	// ============================================================================
	// DAEMON MANAGEMENT
	// ============================================================================
	getDaemonStatus: () => ipcRenderer.invoke("get-daemon-status"),
	restartDaemon: () => ipcRenderer.invoke("restart-daemon"),
	startDaemon: () => ipcRenderer.invoke("start-daemon"),
	stopDaemon: () => ipcRenderer.invoke("stop-daemon"),

	// ============================================================================
	// EVENT LISTENERS
	// ============================================================================
	onAppError: (callback: (error: unknown) => void) => {
		ipcRenderer.on("app-error", (_, error) => callback(error));
	},

	onDaemonStatusUpdate: (callback: (data: unknown) => void) => {
		ipcRenderer.on("daemon-status-update", (_, data) => callback(data));
	},

	offDaemonStatusUpdate: (callback: (data: unknown) => void) => {
		ipcRenderer.removeListener("daemon-status-update", callback);
	},

	removeAllListeners: (channel: string) => {
		ipcRenderer.removeAllListeners(channel);
	},

	// ============================================================================
	// FILE OPERATIONS
	// ============================================================================
	openFiles: (action: "file" | "folder") =>
		ipcRenderer.invoke("openFiles", action),

	handleOpenImages: (imagesObject: {
		success: boolean;
		data: { files: string[] };
	}) => ipcRenderer.invoke("handleOpenImages", imagesObject),

	openContextMenu: (options: {
		Image?: unknown;
		selectedImagesLength: number;
	}) => ipcRenderer.invoke("openContextMenu", options),
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld("API_RENDERER", electronAPI);

// Log successful preload
console.log("✅ Preload script loaded successfully - Go Daemon v2.0.0 API ready");
