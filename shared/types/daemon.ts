// TypeScript interfaces matching Go daemon structs
// Generated from daemon-go/internal/db/models.go and queries.sql.go

// Legacy interface for database compatibility (deprecated)
export interface DaemonImage {
	id: number;
	name: string;
	isChecked: number;
	isSelected: number;
	width: number;
	height: number;
	format: string;
}

// Interface matching JSON store schema exactly (use this for new code)
export interface JsonStoreImage {
	id: number;
	name: string;
	path: string;
	mediaType: string;
	dimensions: {
		width: number;
		height: number;
	};
	metadata: {
		format: string;
		fileSize: number;
		checksum: string;
		tags: string[];
		properties?: Record<string, unknown>;
	};
	selection: {
		isChecked: boolean;
		isSelected: boolean;
		selectedAt?: string;
		selectedPlaylists: string[];
	};
	importInfo: {
		importedAt: string;
		sourcePath?: string;
		importer: string;
	};
	backendHints?: {
		preferredBackends?: string[];
		requireGpu?: boolean;
		maxResolution?: {
			width: number;
			height: number;
		};
	};
	thumbnails: {
		"720p": string;
		"1080p": string;
		"1440p": string;
		"4k": string;
		fallback: string;
	};
}

export interface DaemonPlaylist {
	id: number;
	name: string;
	type: string;
	interval: number | null;
	showAnimations: number;
	alwaysStartOnFirstImage: number;
	order: string | null;
	currentImageIndex: number;
}

export interface DaemonActivePlaylist {
	id: number;
	name: string;
	type: string;
	interval: number | null;
	showAnimations: number;
	alwaysStartOnFirstImage: number;
	order: string | null;
	currentImageIndex: number;
	activeMonitor: string;
	activeMonitorName: string;
}

export interface DaemonImageHistory {
	id: number;
	name: string;
	width: number;
	height: number;
	isChecked: number;
	isSelected: number;
	format: string;
	monitor: string;
	time: string | null;
}

export interface DaemonActivePlaylistInfo {
	playlistId: number;
	activeMonitor: string;
	activeMonitorName: string;
}

export interface DaemonImageInPlaylist {
	imageId: number;
	playlistId: number;
	indexInPlaylist: number;
	time: number | null;
}

export interface DaemonAppConfig {
	config: string;
}

export interface DaemonSwwwConfig {
	config: string;
}

export interface DaemonSelectedMonitor {
	monitor: string;
}

// Response types for IPC calls
export interface DaemonResponse<T = unknown> {
	action: string;
	data?: T;
	error?: string;
	messageId?: number;
}

// Playlist types
export type PlaylistType = "timer" | "never" | "manual";
export type PlaylistOrder = "sequential" | "random";

// Image format types
export type ImageFormat =
	| "jpg"
	| "jpeg"
	| "png"
	| "gif"
	| "bmp"
	| "webp"
	| "svg";

// Monitor types (simplified structure from Go daemon)
export interface DaemonMonitor {
	name: string;
	width: number;
	height: number;
	currentImage: string;
	position: {
		x: number;
		y: number;
	};
}
