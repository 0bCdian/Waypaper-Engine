import { type objectValues } from '../types';

export const PLAYLIST_ORDER = {
    ordered: 'ordered',
    random: 'random'
} as const;

export const PLAYLIST_TYPES = {
    TIMER: 'timer',
    NEVER: 'never',
    TIME_OF_DAY: 'timeofday',
    DAY_OF_WEEK: 'dayofweek'
} as const;

export type PLAYLIST_ORDER_TYPES = objectValues<typeof PLAYLIST_ORDER>;
export type PLAYLIST_TYPES_TYPE = objectValues<typeof PLAYLIST_TYPES>;
