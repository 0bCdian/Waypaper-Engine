import { type Formats } from '../shared/types/image';
import { type ActiveMonitor } from '../shared/types/monitor';
import { type rendererImage } from '../src/types/rendererTypes';
import { type imageSelectType } from '../database/schema';

export enum ACTIONS {
    NEXT_IMAGE = 'next-image',
    NEXT_IMAGE_ALL = 'next-image-all',
    PREVIOUS_IMAGE = 'previous-image',
    PREVIOUS_IMAGE_ALL = 'previous-image-all',
    START_PLAYLIST = 'start-playlist',
    RANDOM_IMAGE = 'random-image',
    STOP_DAEMON = 'stop-daemon',
    PAUSE_PLAYLIST = 'pause-playlist',
    PAUSE_PLAYLIST_ALL = 'pause-playlist-all',
    RESUME_PLAYLIST = 'resume-playlist',
    RESUME_PLAYLIST_ALL = 'resume-playlist-all',
    STOP_PLAYLIST = 'stop-playlist',
    UPDATE_CONFIG = 'update-config',
    STOP_PLAYLIST_BY_NAME = 'stop-playlist-by-name',
    STOP_PLAYLIST_BY_MONITOR_NAME = 'stop-playlist-by-monitor-name',
    STOP_PLAYLIST_ON_REMOVED_DISPLAYS = 'stop-playlist-on-removed-displays',
    STOP_PLAYLIST_ALL = 'stop-playlist-all',
    SET_IMAGE = 'set-image',
    ERROR = 'error',
    DAEMON_CRASH = 'daemon-crash',
    GET_INFO_PLAYLIST = 'get-info-playlist',
    GET_INFO_ACTIVE_PLAYLIST = 'get-info-active-playlist',
    GET_INFO = 'get-info',
    GET_IMAGE_HISTORY = 'get-image-history'
}

// refactor into using a discriminated type
export type message =
    | {
          action:
              | ACTIONS.START_PLAYLIST
              | ACTIONS.STOP_PLAYLIST
              | ACTIONS.NEXT_IMAGE
              | ACTIONS.PREVIOUS_IMAGE
              | ACTIONS.PAUSE_PLAYLIST
              | ACTIONS.RESUME_PLAYLIST;
          playlist: {
              name: string;
              activeMonitor: ActiveMonitor;
          };
      }
    | {
          action: ACTIONS.ERROR;
          error: { error: string };
      }
    | {
          action: ACTIONS.SET_IMAGE;
          image?: imageSelectType | rendererImage;
          activeMonitor?: ActiveMonitor;
      }
    | {
          action:
              | ACTIONS.STOP_DAEMON
              | ACTIONS.RANDOM_IMAGE
              | ACTIONS.UPDATE_CONFIG
              | ACTIONS.STOP_PLAYLIST_ON_REMOVED_DISPLAYS
              | ACTIONS.GET_INFO_PLAYLIST
              | ACTIONS.GET_INFO_ACTIVE_PLAYLIST
              | ACTIONS.GET_INFO
              | ACTIONS.DAEMON_CRASH
              | ACTIONS.NEXT_IMAGE_ALL
              | ACTIONS.PREVIOUS_IMAGE_ALL
              | ACTIONS.RESUME_PLAYLIST_ALL
              | ACTIONS.PAUSE_PLAYLIST_ALL
              | ACTIONS.STOP_PLAYLIST_ALL
              | ACTIONS.GET_IMAGE_HISTORY;
      }
    | {
          action: ACTIONS.STOP_PLAYLIST_BY_NAME;
          playlist: {
              name: string;
          };
      }
    | {
          action: ACTIONS.STOP_PLAYLIST_BY_MONITOR_NAME;
          monitors: string[];
      };

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
