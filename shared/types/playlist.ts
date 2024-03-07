export type ORDER_TYPES = 'ordered' | 'random';

export type PLAYLIST_TYPES = 'timer' | 'never' | 'timeofday' | 'dayofweek';

export interface Playlist {
    id: number;
    name: string;
    type: PLAYLIST_TYPES;
    interval: number | null;
    order: ORDER_TYPES | null;
    showAnimations: boolean;
    currentImageIndex: number;
}
