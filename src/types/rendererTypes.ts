import { type imagesObject } from '../../shared/types';
import { type Formats } from '../../shared/types/image';
import {
    type PLAYLIST_TYPES,
    type ORDER_TYPES
} from '../../shared/types/playlist';
import { type Image } from '../../shared/types/image.ts';
export enum STORE_ACTIONS {
    SET_IMAGES_ARRAY = 'SET_IMAGES_ARRAY',
    SET_SKELETONS_TO_SHOW = 'SET_SKELETONS_TO_SHOW',
    SET_FILTERS = 'SET_FILTERS',
    RESET_IMAGES_ARRAY = 'RESET_IMAGES_ARRAY'
}

export interface configuration {
    playlistType: PLAYLIST_TYPES;
    interval: number | null;
    order: ORDER_TYPES | null;
    showAnimations: boolean | 1 | 0;
}

export interface rendererPlaylist {
    images: Image[];
    configuration: configuration;
    name: string;
}

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
    imagesArray: Image[];
    skeletonsToShow: imagesObject | undefined;
    filters: Filters;
}

export type action =
    | { type: STORE_ACTIONS.SET_IMAGES_ARRAY; payload: Image[] }
    | {
          type: STORE_ACTIONS.SET_SKELETONS_TO_SHOW;
          payload: imagesObject | undefined;
      }
    | { type: STORE_ACTIONS.SET_FILTERS; payload: Filters }
    | { type: STORE_ACTIONS.RESET_IMAGES_ARRAY; payload: Image[] };
