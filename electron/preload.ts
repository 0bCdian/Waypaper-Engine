/**
 * Preload Script for Waypaper Engine
 *
 * Exposes safe APIs to the renderer process via contextBridge.
 * Updated for Go Daemon HTTP REST API
 */

import { contextBridge, ipcRenderer } from "electron";
import type {
	Image,
	ImageQueryParams,
	PaginatedResponse,
	ImageHistoryEntry,
	UpdateImageRequest,
	Playlist,
	CreatePlaylistRequest,
	UpdatePlaylistRequest,
	ActivePlaylistInstance,
	ActivePlaylistResponse,
	Monitor,
	UnifiedConfig,
	SwwwConfig,
	BackendInfo,
	DaemonInfo,
	MonitorMode,
	EventType,
} from "./daemon-go-types";
import type { IPC_RENDERER_EVENTS_TYPE } from "../shared/constants";

const electronAPI = {
	// ============================================================================
	// GO DAEMON API
	// ============================================================================
	goDaemon: {
		// HEALTH & SYSTEM
		ping: (): Promise<boolean> =>
			ipcRenderer.invoke("go-daemon-command", "ping"),

		getInfo: (): Promise<DaemonInfo> =>
			ipcRenderer.invoke("go-daemon-command", "get_info"),

		shutdown: (): Promise<void> =>
			ipcRenderer.invoke("go-daemon-command", "shutdown"),

		// IMAGES
		getImages: (params?: ImageQueryParams): Promise<PaginatedResponse<Image>> =>
			ipcRenderer.invoke("go-daemon-command", "get_images", params),

		getImage: (id: number): Promise<Image> =>
			ipcRenderer.invoke("go-daemon-command", "get_image", { id }),

		getImageCount: (): Promise<{ count: number }> =>
			ipcRenderer.invoke("go-daemon-command", "get_image_count"),

		importImages: (
			paths: string[],
		): Promise<{ status: string; total: number }> =>
			ipcRenderer.invoke("go-daemon-command", "import_images", { paths }),

		deleteImages: (ids: number[]): Promise<{ deleted: number }> =>
			ipcRenderer.invoke("go-daemon-command", "delete_images", { ids }),

		updateImage: (id: number, update: UpdateImageRequest): Promise<Image> =>
			ipcRenderer.invoke("go-daemon-command", "update_image", { id, update }),

		selectAllImages: (
			selected: boolean,
		): Promise<{ updated: number; selected: boolean }> =>
			ipcRenderer.invoke("go-daemon-command", "select_all_images", {
				selected,
			}),

		getImageHistory: (
			limit?: number,
			monitor?: string,
		): Promise<ImageHistoryEntry[]> =>
			ipcRenderer.invoke("go-daemon-command", "get_image_history", {
				limit,
				monitor,
			}),

		// WALLPAPER
		setWallpaper: (
			imageId: number,
			monitor?: string,
			mode?: MonitorMode,
		): Promise<{
			status: string;
			image_id: number;
			monitor: string;
			mode: string;
		}> =>
			ipcRenderer.invoke("go-daemon-command", "set_wallpaper", {
				image_id: imageId,
				monitor: monitor || "*",
				mode: mode || "individual",
			}),

		setRandomWallpaper: (
			monitor?: string,
			mode?: MonitorMode,
		): Promise<{
			status: string;
			image_id: number;
			monitor: string;
			mode: string;
		}> =>
			ipcRenderer.invoke("go-daemon-command", "random_wallpaper", {
				monitor: monitor || "*",
				mode: mode || "individual",
			}),

		// PLAYLISTS
		getPlaylists: (): Promise<Playlist[]> =>
			ipcRenderer.invoke("go-daemon-command", "get_playlists"),

		getPlaylist: (id: number): Promise<Playlist> =>
			ipcRenderer.invoke("go-daemon-command", "get_playlist", { id }),

		createPlaylist: (playlist: CreatePlaylistRequest): Promise<Playlist> =>
			ipcRenderer.invoke("go-daemon-command", "create_playlist", playlist),

		updatePlaylist: (
			id: number,
			update: UpdatePlaylistRequest,
		): Promise<Playlist> =>
			ipcRenderer.invoke("go-daemon-command", "update_playlist", {
				id,
				update,
			}),

		deletePlaylist: (id: number): Promise<void> =>
			ipcRenderer.invoke("go-daemon-command", "delete_playlist", { id }),

		startPlaylist: (
			id: number,
			monitor?: string,
			mode?: MonitorMode,
		): Promise<void> =>
			ipcRenderer.invoke("go-daemon-command", "start_playlist", {
				id,
				monitor: monitor || "*",
				mode: mode || "individual",
			}),

		stopPlaylist: (id: number): Promise<void> =>
			ipcRenderer.invoke("go-daemon-command", "stop_playlist", { id }),

		pausePlaylist: (id: number): Promise<void> =>
			ipcRenderer.invoke("go-daemon-command", "pause_playlist", { id }),

		resumePlaylist: (id: number): Promise<void> =>
			ipcRenderer.invoke("go-daemon-command", "resume_playlist", { id }),

		nextPlaylistImage: (id: number): Promise<void> =>
			ipcRenderer.invoke("go-daemon-command", "next_playlist_image", { id }),

		previousPlaylistImage: (id: number): Promise<void> =>
			ipcRenderer.invoke("go-daemon-command", "previous_playlist_image", {
				id,
			}),

		getActivePlaylists: (): Promise<ActivePlaylistResponse[]> =>
			ipcRenderer.invoke("go-daemon-command", "get_active_playlists"),

		getActivePlaylistForMonitor: (
			monitor: string,
		): Promise<ActivePlaylistInstance> =>
			ipcRenderer.invoke(
				"go-daemon-command",
				"get_active_playlist_for_monitor",
				{ monitor },
			),

		stopAllPlaylists: (): Promise<void> =>
			ipcRenderer.invoke("go-daemon-command", "stop_all_playlists"),

		// MONITORS
		getMonitors: (): Promise<Monitor[]> =>
			ipcRenderer.invoke("go-daemon-command", "get_monitors"),

		getMonitor: (name: string): Promise<Monitor> =>
			ipcRenderer.invoke("go-daemon-command", "get_monitor", { name }),

		// CONFIG
		getConfig: (): Promise<UnifiedConfig> =>
			ipcRenderer.invoke("go-daemon-command", "get_config"),

		updateConfig: (config: Partial<UnifiedConfig>): Promise<UnifiedConfig> =>
			ipcRenderer.invoke("go-daemon-command", "update_config", config),

		getConfigSection: (section: string): Promise<unknown> =>
			ipcRenderer.invoke("go-daemon-command", "get_config_section", {
				section,
			}),

		updateConfigSection: (
			section: string,
			data: Record<string, unknown>,
		): Promise<unknown> =>
			ipcRenderer.invoke("go-daemon-command", "update_config_section", {
				section,
				data,
			}),

		getBackendConfig: (): Promise<SwwwConfig> =>
			ipcRenderer.invoke("go-daemon-command", "get_backend_config"),

		updateBackendConfig: (config: Partial<SwwwConfig>): Promise<void> =>
			ipcRenderer.invoke("go-daemon-command", "update_backend_config", config),

		// BACKENDS
		getBackends: (): Promise<BackendInfo[]> =>
			ipcRenderer.invoke("go-daemon-command", "get_backends"),

		activateBackend: (
			name: string,
		): Promise<{ status: string; backend: string }> =>
			ipcRenderer.invoke("go-daemon-command", "activate_backend", { name }),

		// EVENT LISTENERS (SSE events forwarded via IPC)
		// Returns a disposer function that removes the listener when called.
		// contextBridge does not preserve function identity, so the classic
		// on/off(callback) pattern cannot work. The disposer captures the
		// exact wrapper reference in the preload closure.
		on: (
			event: EventType,
			callback: (data: unknown) => void,
		): (() => void) => {
			const channel = `go-daemon-event-${event}`;
			const wrapper = (_: Electron.IpcRendererEvent, data: unknown) =>
				callback(data);
			ipcRenderer.on(channel, wrapper);
			return () => {
				ipcRenderer.off(channel, wrapper);
			};
		},
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
	// MENU / IPC RENDERER EVENTS
	// ============================================================================
	onMenuEvent: (
		event: IPC_RENDERER_EVENTS_TYPE,
		callback: (...args: unknown[]) => void,
	): void => {
		ipcRenderer.on(event, (_event, ...args) => callback(...args));
	},

	offMenuEvent: (
		event: IPC_RENDERER_EVENTS_TYPE,
		callback: (...args: unknown[]) => void,
	): void => {
		ipcRenderer.removeListener(event, callback);
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

console.log("Preload script loaded - Go Daemon HTTP REST API ready");
