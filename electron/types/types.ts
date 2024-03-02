import {
    type ORDER_TYPES,
    type PLAYLIST_TYPES
} from "../../src/types/rendererTypes";
export interface imagesObject {
    imagePaths: string[];
    fileNames: string[];
}

export interface Image {
    id: number;
    name: string;
    isChecked: boolean | 1 | 0;
    width: number;
    height: number;
    format: string;
}

export interface Playlist {
    id: number;
    name: string;
    type: PLAYLIST_TYPES;
    interval: number | null;
    order: ORDER_TYPES | null;
    showAnimations: boolean | 1 | 0;
    currentImageIndex: number;
}

export enum ACTIONS {
    NEXT_IMAGE = "next-image",
    PREVIOUS_IMAGE = "previous-image",
    RANDOM_IMAGE = "random-image",
    START_PLAYLIST = "start-playlist",
    STOP_DAEMON = "stop-daemon",
    PAUSE_PLAYLIST = "pause-playlist",
    RESUME_PLAYLIST = "resume-playlist",
    STOP_PLAYLIST = "stop-playlist",
    UPDATE_CONFIG = "update-config",
    UPDATE_PLAYLIST = "update-playlist"
}

export interface message {
    action: ACTIONS;
    message?: string;
}

export interface PlaylistControllerType {
    startPlaylist: () => void;
    pausePlaylist: () => void;
    resumePlaylist: () => void;
    stopPlaylist: () => void;
    nextImage: () => void;
    previousImage: () => void;
    randomImage: () => void;
    killDaemon: () => void;
}

export enum dbTables {
    Images = "Images",
    Playlists = "Playlists",
    imagesInPlaylist = "imagesInPlaylist",
    swwwConfig = "swwwConfig",
    appConfig = "appConfig",
    activePlaylist = "activePlaylist",
    monitors = "monitors"
}

export interface imageInPlaylist {
    name: string;
    time: number | null;
}

export interface Monitor {
    name: string;
    width: number;
    height: number;
    currentImage: string;
    position: number;
}

export interface imageMetadata {
    name: string;
    format: string;
    width: number;
    height: number;
}

export interface ActivePlaylist extends Playlist {
    images: imageInPlaylist[];
}

interface wlr_randr_monitor {
    name: string;
    description: string;
    make: string;
    model: string;
    serial: string;
    physical_size: {
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
    adaptive_sync: boolean;
}
export type wlr_output = wlr_randr_monitor[];
