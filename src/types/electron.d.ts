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
} from "../../electron/daemon-go-types";
declare global {
	const __DEBUG__: boolean;
	interface Window {
		monitors?: {
			showModal: () => void;
			closeModal: () => void;
			close: () => void;
		};
		API_RENDERER: {
			goDaemon: {
				// HEALTH & SYSTEM
				ping: () => Promise<boolean>;
				getInfo: () => Promise<DaemonInfo>;
				shutdown: () => Promise<void>;

				// IMAGES
				getImages: (
					params?: ImageQueryParams,
				) => Promise<PaginatedResponse<Image>>;
				getImage: (id: number) => Promise<Image>;
				getImageCount: () => Promise<{ count: number }>;
				importImages: (
					paths: string[],
				) => Promise<{ status: string; total: number }>;
				deleteImages: (ids: number[]) => Promise<{ deleted: number }>;
				updateImage: (id: number, update: UpdateImageRequest) => Promise<Image>;
				renameImage: (id: number, name: string) => Promise<Image>;
				selectAllImages: (
					selected: boolean,
				) => Promise<{ updated: number; selected: boolean }>;
				getImageTags: () => Promise<{ tags: string[] }>;
				getImageHistory: (
					limit?: number,
					monitor?: string,
				) => Promise<ImageHistoryEntry[]>;

				// WALLPAPER
				setWallpaper: (
					imageId: number,
					monitor?: string,
					mode?: MonitorMode,
				) => Promise<{
					status: string;
					image_id: number;
					monitor: string;
					mode: string;
				}>;
				setRandomWallpaper: (
					monitor?: string,
					mode?: MonitorMode,
				) => Promise<{
					status: string;
					image_id: number;
					monitor: string;
					mode: string;
				}>;

				// PLAYLISTS
				getPlaylists: () => Promise<Playlist[]>;
				getPlaylist: (id: number) => Promise<Playlist>;
				createPlaylist: (playlist: CreatePlaylistRequest) => Promise<Playlist>;
				updatePlaylist: (
					id: number,
					update: UpdatePlaylistRequest,
				) => Promise<Playlist>;
				deletePlaylist: (id: number) => Promise<void>;
				startPlaylist: (
					id: number,
					monitor?: string,
					mode?: MonitorMode,
				) => Promise<void>;
				stopPlaylist: (id: number) => Promise<void>;
				pausePlaylist: (id: number) => Promise<void>;
				resumePlaylist: (id: number) => Promise<void>;
				nextPlaylistImage: (id: number) => Promise<void>;
				previousPlaylistImage: (id: number) => Promise<void>;
				getActivePlaylists: () => Promise<ActivePlaylistResponse[]>;
				getActivePlaylistForMonitor: (
					monitor: string,
				) => Promise<ActivePlaylistInstance>;
				stopAllPlaylists: () => Promise<void>;

				// MONITORS
				getMonitors: () => Promise<Monitor[]>;
				getMonitor: (name: string) => Promise<Monitor>;

				// CONFIG
				getConfig: () => Promise<UnifiedConfig>;
				updateConfig: (
					config: Partial<UnifiedConfig>,
				) => Promise<UnifiedConfig>;
				getConfigSection: (section: string) => Promise<unknown>;
				updateConfigSection: (
					section: string,
					data: Record<string, unknown>,
				) => Promise<unknown>;
				getBackendConfig: () => Promise<SwwwConfig>;
				updateBackendConfig: (config: Partial<SwwwConfig>) => Promise<void>;

				// BACKENDS
				getBackends: () => Promise<BackendInfo[]>;
				activateBackend: (
					name: string,
				) => Promise<{ status: string; backend: string }>;

				// EVENT LISTENERS
				on: (
					event: EventType,
					callback: (data: unknown) => void,
				) => () => void;
			};

			// THEME MANAGEMENT
			getNativeTheme: () => Promise<unknown>;
			setThemeSource: (source: "system" | "light" | "dark") => Promise<void>;
			onNativeThemeUpdated: (callback: (themeInfo: unknown) => void) => void;
			onThemeChanged: (callback: (data: unknown) => void) => void;

			// SYSTEM INFO
			getAppInfo: () => Promise<unknown>;
			ping: () => Promise<unknown>;

			// WINDOW MANAGEMENT
			getWindowBounds: () => Promise<Electron.Rectangle>;
			setWindowBounds: (bounds: Electron.Rectangle) => Promise<void>;
			minimizeWindow: () => Promise<void>;
			maximizeWindow: () => Promise<void>;
			closeWindow: () => Promise<void>;
			hideWindow: () => Promise<void>;
			showWindow: () => Promise<void>;

			// APPLICATION CONTROL
			exitApp: () => Promise<void>;

			// DAEMON MANAGEMENT
			getDaemonStatus: () => Promise<unknown>;
			restartDaemon: () => Promise<unknown>;
			startDaemon: () => Promise<unknown>;
			stopDaemon: () => Promise<unknown>;

			// EVENT LISTENERS
			onAppError: (callback: (error: unknown) => void) => () => void;
			onDaemonStatusUpdate: (callback: (data: unknown) => void) => () => void;
			removeAllListeners: (channel: string) => void;

			// WALLHAVEN API
			wallhaven: {
				search: (params: Record<string, string>) => Promise<unknown>;
				getWallpaper: (id: string, apikey?: string) => Promise<unknown>;
				download: (imageUrl: string) => Promise<string>;
			};

			// FILE OPERATIONS
			getPathForFile: (file: File) => string;
			downloadUrl: (url: string) => Promise<string>;
			openFiles: (action: "file" | "folder") => Promise<{
				success: boolean;
				data?: { files: string[] };
				files?: string[];
				error?: string;
			}>;
			handleOpenImages: (imagesObject: {
				success: boolean;
				data: { files: string[] };
			}) => Promise<{ success: boolean; message?: string; error?: string }>;

			revealInFileManager: (path: string) => Promise<{ success: boolean }>;
		};
	}
}
