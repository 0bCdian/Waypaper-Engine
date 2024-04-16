import { type Formats } from '../shared/types/image';
import { type ActiveMonitor } from '../shared/types/monitor';
import { type rendererImage } from '../src/types/rendererTypes';
import { type imageSelectType } from '../database/schema';

export enum ACTIONS {
    NEXT_IMAGE = 'next-image',
    PREVIOUS_IMAGE = 'previous-image',
    START_PLAYLIST = 'start-playlist',
    RANDOM_IMAGE = 'random-image',
    STOP_DAEMON = 'stop-daemon',
    PAUSE_PLAYLIST = 'pause-playlist',
    RESUME_PLAYLIST = 'resume-playlist',
    STOP_PLAYLIST = 'stop-playlist',
    UPDATE_CONFIG = 'update-config',
    STOP_PLAYLIST_BY_NAME = 'stop-playlist-by-name',
    STOP_PLAYLIST_BY_MONITOR_NAME = 'stop-playlist-by-monitor-name',
    STOP_PLAYLIST_ON_REMOVED_DISPLAYS = 'stop-playlist-on-removed-displays',
    STOP_ALL_PLAYLISTS = 'stop-all-playlists',
    SET_IMAGE = 'set-image',
    ERROR = 'error',
    GET_INFO = 'get-info'
}

// refactor into using a discriminated type
export type message =
    | {
          action:
              | ACTIONS.START_PLAYLIST
              | ACTIONS.STOP_PLAYLIST
              | ACTIONS.NEXT_IMAGE
              | ACTIONS.PREVIOUS_IMAGE
              | ACTIONS.GET_INFO
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
          image: imageSelectType | rendererImage;
      }
    | {
          action:
              | ACTIONS.STOP_DAEMON
              | ACTIONS.RANDOM_IMAGE
              | ACTIONS.UPDATE_CONFIG
              | ACTIONS.STOP_PLAYLIST_ON_REMOVED_DISPLAYS
              | ACTIONS.STOP_ALL_PLAYLISTS;
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
