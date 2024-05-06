import { ipcRenderer } from 'electron';
import { configuration } from '../globals/config';
import {
    type rendererImage,
    type rendererPlaylist
} from '../src/types/rendererTypes';
import { join } from 'node:path';
import { type openFileAction, type imagesObject } from '../shared/types';
import { type ActiveMonitor, type Monitor } from '../shared/types/monitor';
import {
    type playlistSelectType,
    type imageSelectType,
    type appConfigSelectType,
    type appConfigInsertType,
    type swwwConfigSelectType,
    type swwwConfigInsertType
} from '../database/schema';
import {
    type IPC_MAIN_EVENTS_TYPE,
    type IPC_RENDERER_EVENTS_TYPE,
    type SHORTCUT_EVENTS_TYPE
} from '../shared/constants';
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
    setImage: (image: rendererImage, activeMonitor: ActiveMonitor) => {
        ipcRenderer.send('setImage', image, activeMonitor);
    },
    setRandomImage: () => {
        ipcRenderer.send('setRandomImage');
    },
    savePlaylist: (playlistObject: rendererPlaylist) => {
        ipcRenderer.send('savePlaylist', playlistObject);
    },
    startPlaylist: (playlist: {
        name: string;
        activeMonitor: ActiveMonitor;
    }) => {
        ipcRenderer.send('startPlaylist', playlist);
    },
    queryPlaylists: async (): Promise<playlistSelectType[]> => {
        return await ipcRenderer.invoke('queryPlaylists');
    },
    querySelectedMonitor: async (): Promise<ActiveMonitor | undefined> => {
        return await ipcRenderer.invoke('querySelectedMonitor');
    },
    setSelectedMonitor: (selectedMonitor: ActiveMonitor) => {
        ipcRenderer.send('setSelectedMonitor', selectedMonitor);
    },
    getPlaylistImages: async (playlistID: number): Promise<rendererImage[]> => {
        return await ipcRenderer.invoke('getPlaylistImages', playlistID);
    },
    stopPlaylist: (playlist: {
        name: string;
        activeMonitor: ActiveMonitor;
    }) => {
        ipcRenderer.send('stopPlaylist', playlist);
    },
    deleteImagesFromGallery: async (images: rendererImage[]) => {
        return await ipcRenderer.invoke('deleteImageFromGallery', images);
    },
    deletePlaylist: (playlistName: string) => {
        ipcRenderer.send('deletePlaylist', playlistName);
    },
    openContextMenu: ({
        Image,
        selectedImagesLength
    }: {
        Image: rendererImage | undefined;
        selectedImagesLength: number;
    }) => {
        ipcRenderer.send('openContextMenuImage', Image, selectedImagesLength);
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
        monitor: ActiveMonitor
    ): Promise<
        (playlistSelectType & { images: rendererImage[] }) | undefined
    > => {
        return await ipcRenderer.invoke('readActivePlaylist', monitor);
    },
    onClearPlaylist: (
        callback: (
            _: Electron.IpcRendererEvent,
            playlist: {
                name: string;
                activeMonitor: ActiveMonitor;
            }
        ) => void
    ) => {
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
    registerListener: ({
        listener,
        channel
    }: {
        channel:
            | IPC_RENDERER_EVENTS_TYPE
            | SHORTCUT_EVENTS_TYPE
            | IPC_MAIN_EVENTS_TYPE;
        listener: (event: Electron.IpcRendererEvent, ...args: any[]) => void;
    }) => {
        const listeners = ipcRenderer.listeners(channel);
        if (listeners.length > 0) {
            ipcRenderer.removeAllListeners(channel);
        }
        ipcRenderer.addListener(channel, listener);
    },
    getThumbnailSrc: (imageName: string) => {
        return (
            'atom://' +
            join(
                configuration.directories.thumbnails,
                imageName.split('.')[0] + '.webp'
            )
        );
    },
    getImageSrc: (imageName: string) => {
        return 'atom://' + join(configuration.directories.imagesDir, imageName);
    }
};
type ELECTRON_API_TYPE = typeof ELECTRON_API;

declare global {
    interface Window {
        API_RENDERER: ELECTRON_API_TYPE;
    }
}
