import { type Playlist } from '../../shared/types/playlist';

export enum ACTIONS {
    NEXT_IMAGE = 'next-image',
    PREVIOUS_IMAGE = 'previous-image',
    RANDOM_IMAGE = 'random-image',
    START_PLAYLIST = 'start-playlist',
    STOP_DAEMON = 'stop-daemon',
    PAUSE_PLAYLIST = 'pause-playlist',
    RESUME_PLAYLIST = 'resume-playlist',
    STOP_PLAYLIST = 'stop-playlist',
    UPDATE_CONFIG = 'update-config',
    UPDATE_PLAYLIST = 'update-playlist'
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

export interface imageInPlaylist {
    name: string;
    time: number | null;
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
