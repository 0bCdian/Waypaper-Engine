import { type imageSelectType } from '../database/schema';
import {
    type PLAYLIST_ORDER_TYPES,
    type PLAYLIST_TYPES_TYPE
} from './playlist';

export type fileList = string[] | undefined;
export interface imagesObject {
    imagePaths: string[];
    fileNames: string[];
}
export enum ORDER_TYPES {
    ORDERED = 'ordered',
    RANDOM = 'random'
}
export type Formats =
    | 'jpg'
    | 'jpeg'
    | 'png'
    | 'bmp'
    | 'gif'
    | 'webp'
    | 'farbfeld'
    | 'pnm'
    | 'tga'
    | 'tiff';
export interface type {
    images: images;
    id: number;
    name: string;
    type: PLAYLIST_TYPES;
    interval: number | null;
    order: ORDER_TYPES | null;
    showAnimations: boolean | 0 | 1;
    currentImageIndex: number;
}
export enum PLAYLIST_TYPES {
    TIMER = 'timer',
    NEVER = 'never',
    TIME_OF_DAY = 'timeofday',
    DAY_OF_WEEK = 'dayofweek'
}

export interface imageModel {
    id: number;
    imageName: string;
}

export interface PlaylistDB {
    id: number;
    name: string;
    type: PLAYLIST_TYPES;
    interval: number | null;
    order: ORDER_TYPES | null;
    showAnimations: boolean | 1 | 0;
    currentImageIndex: number;
}

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
    STOP_ALL_PLAYLISTS = 'stop-all-playlists',
    STOP_PLAYLIST_BY_MONITOR_NAME = 'stop-playlist-by-monitor-name',
    STOP_PLAYLIST_ON_REMOVED_DISPLAYS = 'stop-playlist-on-removed-displays',
    SET_IMAGE = 'set-image',
    ERROR = 'error',
    GET_INFO = 'get-info'
}
export interface ActiveMonitor {
    name: string;
    monitors: Monitor[];
    extendAcrossMonitors: boolean;
}
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
              | ACTIONS.STOP_ALL_PLAYLISTS
              | ACTIONS.SET_IMAGE;
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

export type images = Array<{ name: string; time: number | null }>;

export enum dbTables {
    Images = 'Images',
    Playlists = 'Playlists',
    imagesInPlaylist = 'imagesInPlaylist',
    swwwConfig = 'swwwConfig',
    appConfig = 'appConfig',
    activePlaylist = 'activePlaylist'
}

export interface imageInPlaylist {
    imageID: number;
    playlistID: number;
    indexInPlaylist: number;
    time: number | null;
}

export interface Image {
    id: number;
    name: string;
    isChecked: boolean | 1 | 0;
    width: number;
    height: number;
    format: string;
}
export interface initialAppConfigDB {
    killDaemon: number;
    playlistStartOnFirstImage: number;
    notifications: number;
    swwwAnimations: number;
    introAnimation: number;
    startMinimized: number;
}
export interface initialAppConfig {
    killDaemon: boolean;
    playlistStartOnFirstImage: boolean;
    notifications: boolean;
    swwwAnimations: boolean;
    introAnimation: boolean;
    startMinimized: boolean;
}
export type initialAppConfigKey = keyof initialAppConfigDB;

export enum ResizeType {
    crop = 'crop',
    fit = 'fit',
    none = 'no'
}
export enum FilterType {
    Lanczos3 = 'Lanczos3',
    Bilinear = 'Bilinear',
    CatmullRom = 'CatmullRom',
    Mitchell = 'Mitchell',
    Nearest = 'Nearest'
}
export enum TransitionType {
    none = 'none',
    simple = 'simple',
    fade = 'fade',
    left = 'left',
    right = 'right',
    top = 'top',
    bottom = 'bottom',
    wipe = 'wipe',
    wave = 'wave',
    grow = 'grow',
    center = 'center',
    any = 'any',
    outer = 'outer',
    random = 'random'
}

export enum transitionPosition {
    center = 'center',
    top = 'top',
    left = 'left',
    right = 'right',
    bottom = 'bottom',
    topLeft = 'top-left',
    topRight = 'top-right',
    bottomLeft = 'bottom-left',
    bottomRight = 'bottom-right'
}

export interface Monitor {
    name: string;
    width: number;
    height: number;
    currentImage: string;
    position: {
        x: number;
        y: number;
    };
}
export interface imageMetadata {
    name: string;
    format: Formats;
    width: number;
    height: number;
}
export interface configuration {
    type: PLAYLIST_TYPES_TYPE;
    interval: number | null;
    order: PLAYLIST_ORDER_TYPES | null;
    showAnimations: boolean;
    alwaysStartOnFirstImage: boolean;
}
export interface rendererPlaylist {
    images: rendererImage[];
    configuration: configuration;
    name: string;
    activeMonitor: ActiveMonitor;
}
export interface rendererImage extends imageSelectType {
    time: number | null;
}
export interface cacheJson {
    imageName: string;
    monitors: Array<{
        currentImage: string;
        name: string;
        width: number;
        height: number;
        position: {
            x: number;
            y: number;
        };
    }>;
}
