import { type Monitor } from './types/monitor';

export type openFileAction = 'file' | 'folder';

export interface imagesObject {
    imagePaths: string[];
    fileNames: string[];
}

export type objectValues<T> = T[keyof T];

export interface CacheJSON {
    imageName: string;
    monitors: Monitor[];
}
