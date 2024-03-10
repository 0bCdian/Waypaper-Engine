import { type Formats } from '../../shared/types/image';

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
    playlist?: {
        id?: number;
        monitor?: string;
        name?: string;
    };
}

export interface imageInPlaylist {
    name: string;
    time: number | null;
}

export interface imageMetadata {
    name: string;
    format: Formats;
    width: number;
    height: number;
}
