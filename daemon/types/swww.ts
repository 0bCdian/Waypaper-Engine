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
export type transitionPositionType = 'alias' | 'int' | 'float';
export interface swwwConfig {
    resizeType: ResizeType;
    fillColor: string;
    filterType: FilterType;
    transitionType: TransitionType;
    transitionStep: number;
    transitionDuration: number;
    transitionFPS: number;
    transitionAngle: number;
    transitionPositionType: transitionPositionType;
    transitionPosition: transitionPosition;
    transitionPositionIntX: number;
    transitionPositionIntY: number;
    transitionPositionFloatX: number;
    transitionPositionFloatY: number;
    invertY: boolean;
    transitionBezier: string;
    transitionWaveX: number;
    transitionWaveY: number;
}
