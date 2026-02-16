// Re-export Image type from the canonical daemon types
// This file replaces the old JsonStoreImage and legacy daemon types
export type {
	Image,
	ImageThumbnails,
	ImageHistoryEntry,
	ImageHistorySource,
	Playlist,
	PlaylistImage,
	PlaylistConfiguration,
	ActivePlaylistInstance,
	Monitor,
	MonitorMode,
	DaemonInfo,
	UnifiedConfig,
	AppConfig,
	DaemonConfig,
	SwwwConfig,
	BackendSection,
	MonitorsConfig,
	BackendInfo,
	BackendCapabilities,
	EventType,
	Pagination,
	PaginatedResponse,
	ImageQueryParams,
} from "../../electron/daemon-go-types";

// Legacy alias for backward compatibility during migration
import type { Image } from "../../electron/daemon-go-types";
export type JsonStoreImage = Image;
