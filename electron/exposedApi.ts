import { ipcRenderer } from 'electron';
import { appDirectories } from './globals/globals';
import { type rendererPlaylist } from '../src/types/rendererTypes';
import { join } from 'node:path';
import { type swwwConfig } from './database/swwwConfig';
import { type AppConfigDB } from '../src/routes/AppConfiguration';
import { type openFileAction, type imagesObject } from '../shared/types';
import { type Image } from '../shared/types/image';
import { type Monitor } from '../shared/types/monitor';
import { type Playlist } from '../shared/types/playlist';
import { type imageInPlaylist } from './types/types';

export const ELECTRON_API = {
    openFiles: async (action: openFileAction) =>
        await ipcRenderer.invoke('openFiles', action),
    handleOpenImages: async (imagesObject: imagesObject): Promise<Image[]> => {
        return await ipcRenderer.invoke('handleOpenImages', imagesObject);
    },
    queryImages: async () => {
        return await ipcRenderer.invoke('queryImages');
    },
    setImage: (image: string) => {
        ipcRenderer.send('setImage', image);
    },
    setImageExtended: (image: Image, monitors: Monitor[]) => {
        ipcRenderer.send('setImageExtended', image, monitors);
    },
    savePlaylist: (playlistObject: rendererPlaylist) => {
        ipcRenderer.send('savePlaylist', playlistObject);
    },
    startPlaylist: (playlistName: string) => {
        ipcRenderer.send('startPlaylist', playlistName);
    },
    queryPlaylists: async (): Promise<Playlist[]> => {
        return await ipcRenderer.invoke('queryPlaylists');
    },
    getPlaylistImages: async (
        playlistID: number
    ): Promise<imageInPlaylist[]> => {
        return await ipcRenderer.invoke('getPlaylistImages', playlistID);
    },
    stopPlaylist: () => {
        ipcRenderer.send('stopPlaylist');
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
    openContextMenu: (Image: Image) => {
        ipcRenderer.send('openContextMenuImage', Image);
    },
    openContextMenuGallery: () => {
        ipcRenderer.send('openContextMenuGallery');
    },
    updateSwwwConfig: (newConfig: swwwConfig) => {
        ipcRenderer.send('updateSwwwConfig', newConfig);
    },
    readSwwwConfig: async () => {
        return await ipcRenderer.invoke('readSwwwConfig');
    },
    readAppConfig: async (): Promise<AppConfigDB> => {
        return await ipcRenderer.invoke('readAppConfig');
    },
    updateAppConfig: (newAppConfig: AppConfigDB) => {
        ipcRenderer.send('updateAppConfig', newAppConfig);
    },

    readActivePlaylist: async () => {
        return await ipcRenderer.invoke('readActivePlaylist');
    },
    onClearPlaylist: (callback: () => void) => {
        ipcRenderer.on('clearPlaylist', callback);
    },
    onDeleteImageFromGallery: (
        callback: (_event: Electron.IpcRendererEvent, image: Image) => void
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
