// TypeScript interfaces matching Go daemon structs
// Generated from daemon-go/internal/db/models.go and queries.sql.go

export interface DaemonImage {
    id: number;
    name: string;
    isChecked: number;
    isSelected: number;
    width: number;
    height: number;
    format: string;
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
export interface DaemonResponse<T = any> {
    action: string;
    data?: T;
    error?: string;
    messageId?: number;
}

// Playlist types
export type PlaylistType = "timer" | "never" | "manual";
export type PlaylistOrder = "sequential" | "random";

// Image format types
export type ImageFormat = "jpg" | "jpeg" | "png" | "gif" | "bmp" | "webp" | "svg";

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
