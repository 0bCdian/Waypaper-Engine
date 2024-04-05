import { type Formats } from '../../shared/types/image';
import { type ActiveMonitor } from '../../shared/types/monitor';

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
    ERROR = 'error',
    GET_INFO = 'get-info'
}

// refactor into using a discriminated type
export interface message {
    action: ACTIONS;
    playlist?: {
        name: string;
        activeMonitor: ActiveMonitor;
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
