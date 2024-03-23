import {
    type swwwConfig,
    FilterType,
    ResizeType,
    TransitionType,
    transitionPosition
} from './types/swww';
import { type appConfigType } from './types/app';
import { type Formats } from './types/image';
import { type objectValues } from './types';

export const validImageExtensions: Formats[] = [
    'jpeg',
    'jpg',
    'png',
    'gif',
    'bmp',
    'webp',
    'pnm',
    'tga',
    'tiff',
    'farbfeld'
];

export const initialAppConfig: appConfigType = {
    killDaemon: false,
    playlistStartOnFirstImage: false,
    notifications: true,
    swwwAnimations: true,
    startMinimized: false,
    minimizeInsteadOfClose: false,
    randomImageMonitor: 'clone',
    showMonitorModalOnStart: true
};

export const initialSwwwConfig: swwwConfig = {
    resizeType: ResizeType.crop,
    fillColor: '#000000',
    filterType: FilterType.Lanczos3,
    transitionType: TransitionType.simple,
    transitionStep: 90,
    transitionDuration: 3,
    transitionFPS: 60,
    transitionAngle: 45,
    transitionPositionType: 'alias',
    transitionPosition: transitionPosition.center,
    transitionPositionIntX: 960,
    transitionPositionIntY: 540,
    transitionPositionFloatX: 0.5,
    transitionPositionFloatY: 0.5,
    invertY: false,
    transitionBezier: '.25,.1,.25,1',
    transitionWaveX: 20,
    transitionWaveY: 20
};

export const SHORTCUT_EVENTS = {
    selectAllImagesInCurrentPage: 'selectAllImagesInCurrentPage',
    clearSelection: 'clearSelection',
    selectAllImagesInGallery: 'selectAllImagesInGallery'
} as const;

export type SHORTCUT_EVENTS_TYPE = objectValues<typeof SHORTCUT_EVENTS>;
export const mainEventsList = {};
