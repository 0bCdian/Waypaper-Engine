import { ipcRenderer } from 'electron';
import { appDirectories } from './globals/appPaths';
import {
    type rendererImage,
    type rendererPlaylist
} from '../src/types/rendererTypes';
import { join } from 'node:path';
import { type openFileAction, type imagesObject } from '../shared/types';
import { type Monitor } from '../shared/types/monitor';
import { type imageInPlaylist } from './types/types';
import {
    type playlistSelectType,
    type imageSelectType,
    type appConfigSelectType,
    type appConfigInsertType,
    type swwwConfigSelectType,
    type swwwConfigInsertType
} from './database/schema';

export const ELECTRON_API = {
    openFiles: async (action: openFileAction) =>
        await ipcRenderer.invoke('openFiles', action),
    handleOpenImages: async (
        imagesObject: imagesObject
    ): Promise<imageSelectType[]> => {
        return await ipcRenderer.invoke('handleOpenImages', imagesObject);
    },
    queryImages: async (): Promise<rendererImage[]> => {
        return await ipcRenderer.invoke('queryImages');
    },
    setImage: (image: string) => {
        ipcRenderer.send('setImage', image);
    },
    setImageExtended: (image: rendererImage, monitors: Monitor[]) => {
        ipcRenderer.send('setImageExtended', image, monitors);
    },
    savePlaylist: (playlistObject: rendererPlaylist) => {
        ipcRenderer.send('savePlaylist', playlistObject);
    },
    startPlaylist: (playlist: { name: string; monitor: string }) => {
        ipcRenderer.send('startPlaylist', playlist);
    },
    queryPlaylists: async (): Promise<playlistSelectType[]> => {
        return await ipcRenderer.invoke('queryPlaylists');
    },
    getPlaylistImages: async (
        playlistID: number
    ): Promise<imageInPlaylist[]> => {
        return await ipcRenderer.invoke('getPlaylistImages', playlistID);
    },
    stopPlaylist: (playlist: { name: string; monitor: string }) => {
        ipcRenderer.send('stopPlaylist', playlist);
    },
    deleteImageFromGallery: async (imageID: number, imageName: string) => {
        return await ipcRenderer.invoke(
            'deleteImageFromGallery',
            imageID,
            imageName
        );
    },
    deletePlaylist: (playlistName: string) => {
        ipcRenderer.send('deletePlaylist', playlistName);
    },
    openContextMenu: (Image: rendererImage) => {
        ipcRenderer.send('openContextMenuImage', Image);
    },
    openContextMenuGallery: () => {
        ipcRenderer.send('openContextMenuGallery');
    },
    updateSwwwConfig: (newConfig: swwwConfigInsertType['config']) => {
        ipcRenderer.send('updateSwwwConfig', newConfig);
    },
    readSwwwConfig: async (): Promise<swwwConfigSelectType['config']> => {
        return await ipcRenderer.invoke('readSwwwConfig');
    },
    readAppConfig: async (): Promise<appConfigSelectType['config']> => {
        return await ipcRenderer.invoke('readAppConfig');
    },
    updateAppConfig: (newAppConfig: appConfigInsertType['config']) => {
        ipcRenderer.send('updateAppConfig', newAppConfig);
    },

    readActivePlaylist: async (
        monitor: string
    ): Promise<
        (playlistSelectType & { images: rendererImage[] }) | undefined
    > => {
        return await ipcRenderer.invoke('readActivePlaylist', monitor);
    },
    onClearPlaylist: (callback: () => void) => {
        ipcRenderer.on('clearPlaylist', callback);
    },
    onDeleteImageFromGallery: (
        callback: (
            _event: Electron.IpcRendererEvent,
            image: rendererImage
        ) => void
    ) => {
        ipcRenderer.on('deleteImageFromGallery', callback);
    },
    onStartPlaylist: (
        callback: (event: Electron.IpcRendererEvent, ...args: any[]) => void
    ) => {
        ipcRenderer.on('startPlaylist', callback);
    },
    exitApp: () => {
        ipcRenderer.send('exitApp');
    },
    getMonitors: async () => {
        return await (ipcRenderer.invoke('getMonitors') as Promise<Monitor[]>);
    },
    updateTray: () => {
        ipcRenderer.send('updateTray');
    },
    join,
    thumbnailDirectory: appDirectories.thumbnails,
    imagesDirectory: appDirectories.imagesDir
};
export type ELECTRON_API_TYPE = typeof ELECTRON_API;
