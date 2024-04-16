import { type imagesObject } from '../../shared/types';
import { type Formats } from '../../shared/types/image';
import {
    type PLAYLIST_TYPES_TYPE,
    type PLAYLIST_ORDER_TYPES
} from '../../shared/types/playlist';
import { type imageSelectType } from '../../database/schema';
import { type ActiveMonitor } from '../../shared/types/monitor';
import { type ELECTRON_API_TYPE } from '../../electron/exposedApi';
declare global {
    interface Window {
        API_RENDERER: ELECTRON_API_TYPE;
    }
}
export enum STORE_ACTIONS {
    SET_IMAGES_ARRAY = 'SET_IMAGES_ARRAY',
    SET_SKELETONS_TO_SHOW = 'SET_SKELETONS_TO_SHOW',
    SET_FILTERS = 'SET_FILTERS',
    RESET_IMAGES_ARRAY = 'RESET_IMAGES_ARRAY'
}

export interface configuration {
    type: PLAYLIST_TYPES_TYPE;
    interval: number | null;
    order: PLAYLIST_ORDER_TYPES | null;
    showAnimations: boolean;
    alwaysStartOnFirstImage: boolean;
}

export interface rendererImage extends imageSelectType {
    time: number | null;
}
export interface rendererPlaylist {
    images: rendererImage[];
    configuration: configuration;
    name: string;
    activeMonitor: ActiveMonitor;
}
export type monitorSelectType = 'individual' | 'clone' | 'extend';
export interface Filters {
    order: 'asc' | 'desc';
    type: 'name' | 'id';
    searchString: string;
    advancedFilters: advancedFilters;
}

export interface advancedFilters {
    formats: Formats[];
    resolution: {
        constraint: resolutionConstraints;
        width: number;
        height: number;
    };
}

export type resolutionConstraints = 'all' | 'exact' | 'moreThan' | 'lessThan';
export interface state {
    imagesArray: rendererImage[];
    skeletonsToShow: imagesObject | undefined;
    filters: Filters;
}

export type action =
    | { type: STORE_ACTIONS.SET_IMAGES_ARRAY; payload: rendererImage[] }
    | {
          type: STORE_ACTIONS.SET_SKELETONS_TO_SHOW;
          payload: imagesObject | undefined;
      }
    | { type: STORE_ACTIONS.SET_FILTERS; payload: Filters }
    | { type: STORE_ACTIONS.RESET_IMAGES_ARRAY; payload: rendererImage[] };
