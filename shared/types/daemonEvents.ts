// TypeScript interfaces for Go daemon events and responses
// Based on daemon-go/internal/types/events.go and daemon-go/internal/ipc/protocol.go

// Event types from the daemon
export type DaemonEventType = 
    | "processing_started"
    | "image_processed"
    | "image_progress"
    | "image_error" 
    | "processing_complete"
    | "playlist_started"
    | "playlist_stopped"
    | "playlist_paused"
    | "playlist_resumed"
    | "playlist_image_changed"
    | "wallpaper_changed"
    | "image_changed"
    | "monitor_changed"
    | "monitor_disconnected"
    | "config_changed"
    | "images_updated"
    | "playlists_updated"
    | "thumbnail_created"
    | "clear_playlist"
    | "set_images_per_page"
    | "delete_image_from_gallery";

// Base event structure
export interface DaemonEvent {
    type: DaemonEventType;
    payload: unknown;
    metadata: DaemonEventMetadata;
}

// Event metadata
export interface DaemonEventMetadata {
    timestamp: string;
    image?: DaemonImageEventMetadata;
    playlist?: DaemonPlaylistEventMetadata;
    monitor?: DaemonMonitorEventMetadata;
    config?: DaemonConfigEventMetadata;
}

// Image event metadata
export interface DaemonImageEventMetadata {
    id: number;
    name: string;
    path: string;
    thumbnailPath?: string;
    width: number;
    height: number;
    format: string;
    size: number;
}

// Playlist event metadata
export interface DaemonPlaylistEventMetadata {
    id: number;
    name: string;
    type: string;
    activeMonitor?: string;
    currentImageIndex?: number;
}

// Monitor event metadata
export interface DaemonMonitorEventMetadata {
    name: string;
    description: string;
    enabled: boolean;
}

// Config event metadata
export interface DaemonConfigEventMetadata {
    configType: string; // app|daemon|backend
    key: string;
    oldValue?: unknown;
    newValue?: unknown;
}

// Specific event payloads
export interface DaemonProcessingStartedPayload {
    totalImages: number;
    startTime: number;
}

export interface DaemonImageProcessedPayload {
    id: string;
    originalFileName: string;
    uniqueFileName: string;
    path: string;
    width: number;
    height: number;
    format: string;
    size: number;
    thumbnails?: {
        "720p"?: string;
        "1080p"?: string;
        "1440p"?: string;
        "4k"?: string;
    };
    createdAt: number;
}

export interface DaemonImageProgressPayload {
    processed: number;
    total: number;
    current: string;
}

export interface DaemonImageErrorPayload {
    id?: number;
    originalFileName: string;
    fileName: string;
    path: string;
    error: string;
    errorCode?: string;
}

export interface DaemonProcessingCompletePayload {
    totalProcessed: number;
    successCount: number;
    errorCount: number;
    skippedCount: number;
    elapsedTime: string;
    throughput: number; // images per second
}

export interface DaemonImagesUpdatedPayload {
    action: "added" | "removed" | "updated";
    imageIds: number[];
    count: number;
}

export interface DaemonThumbnailCreatedPayload {
    imageName: string;
    thumbnails: {
        "720p": string;
        "1080p": string;
        "1440p": string;
        "4k": string;
        fallback: string;
    };
}

export interface DaemonClearPlaylistPayload {
    name: string;
    activeMonitor: {
        name: string;
        monitors: Array<{
            name: string;
            description: string;
            enabled: boolean;
            width: number;
            height: number;
            currentImage: string;
            position: {
                x: number;
                y: number;
            };
        }>;
        extendAcrossMonitors: boolean;
    };
}

export interface DaemonSetImagesPerPagePayload {
    imagesPerPage: number;
}

export interface DaemonDeleteImageFromGalleryPayload {
    id: number;
    name: string;
    path: string;
}

// Configuration types
export interface DaemonAppConfigPayload {
    killDaemon: boolean;
    notifications: boolean;
    startMinimized: boolean;
    imagesPerPage: number;
    theme: string;
    language: string;
    minimizeInsteadOfClose: boolean;
    showMonitorModalOnStart: boolean;
    randomImageMonitor: string;
}

export interface DaemonSwwwConfigPayload {
    resizeType: string;
    fillColor: string;
    filterType: string;
    transitionType: string;
    transitionStep: number;
    transitionDuration: number;
    transitionFPS: number;
    transitionAngle: number;
    transitionPositionType: string;
    transitionPosition: {
        x: number;
        y: number;
    };
    transitionPositionIntX: number;
    transitionPositionIntY: number;
    transitionPositionFloatX: number;
    transitionPositionFloatY: number;
    invertY: boolean;
    transitionBezier: string;
    transitionWaveX: number;
    transitionWaveY: number;
}

// Playlist types
export interface DaemonPlaylistImage {
    id: number;
    name: string;
    width: number;
    height: number;
    format: string;
    time?: number; // For time-of-day playlists
}

export interface DaemonPlaylistFromDB {
    id: number;
    name: string;
    type: string;
    interval?: number;
    showAnimations: number;
    alwaysStartOnFirstImage: number;
    order?: string;
    currentImageIndex: number;
    images: DaemonPlaylistImage[];
}

// Monitor types
export interface DaemonMonitorInfo {
    name: string;
    description: string;
    make: string;
    model: string;
    serial: string;
    physicalSize: {
        width: number;
        height: number;
    };
    enabled: boolean;
    modes: Array<{
        width: number;
        height: number;
        refresh: number;
        preferred: boolean;
        current: boolean;
    }>;
    position: {
        x: number;
        y: number;
    };
    transform: string;
    scale: number;
    adaptiveSync: boolean;
}

// Utility types for event handlers
export type DaemonEventHandler<T = unknown> = (payload: T) => void;
export type DaemonEventCallback<T = unknown> = (...args: [T]) => void;

// Type guards for event payloads
export function isImageProcessedPayload(payload: unknown): payload is DaemonImageProcessedPayload {
    return (
        typeof payload === 'object' &&
        payload !== null &&
        'id' in payload &&
        'originalFileName' in payload &&
        'fileName' in payload &&
        'path' in payload &&
        'width' in payload &&
        'height' in payload &&
        'format' in payload
    );
}

export function isImageErrorPayload(payload: unknown): payload is DaemonImageErrorPayload {
    return (
        typeof payload === 'object' &&
        payload !== null &&
        'originalFileName' in payload &&
        'fileName' in payload &&
        'path' in payload &&
        'error' in payload
    );
}

export function isProcessingCompletePayload(payload: unknown): payload is DaemonProcessingCompletePayload {
    return (
        typeof payload === 'object' &&
        payload !== null &&
        'totalProcessed' in payload &&
        'successCount' in payload &&
        'errorCount' in payload
    );
}

export function isImagesUpdatedPayload(payload: unknown): payload is DaemonImagesUpdatedPayload {
    return (
        typeof payload === 'object' &&
        payload !== null &&
        'action' in payload &&
        'imageIds' in payload &&
        'count' in payload
    );
}

export function isThumbnailCreatedPayload(payload: unknown): payload is DaemonThumbnailCreatedPayload {
    return (
        typeof payload === 'object' &&
        payload !== null &&
        'imageName' in payload &&
        'thumbnails' in payload
    );
}
