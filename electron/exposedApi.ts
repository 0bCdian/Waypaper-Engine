import { ipcRenderer } from 'electron'
import { appDirectories } from './globals/globals'
import { imagesObject, Playlist } from './types/types'
import { Image, rendererPlaylist } from '../src/types/rendererTypes'
import { join } from 'node:path'
import { swwwConfig } from './database/swwwConfig'
import { AppConfigDB } from '../src/routes/AppConfiguration'
interface ActivePlaylist extends Playlist {
  images: string[]
}
export const ELECTRON_API = {
  openFiles: async () => await ipcRenderer.invoke('openFiles'),
  handleOpenImages: async (imagesObject: imagesObject) => {
    return await ipcRenderer.invoke('handleOpenImages', imagesObject)
  },
  queryImages: async () => {
    return await ipcRenderer.invoke('queryImages')
  },
  setImage: (image: string) => {
    ipcRenderer.send('setImage', image)
  },
  savePlaylist: (playlistObject: rendererPlaylist) => {
    ipcRenderer.send('savePlaylist', playlistObject)
  },
  startPlaylist: (playlistName: string) => {
    ipcRenderer.send('startPlaylist', playlistName)
  },
  queryPlaylists: async (): Promise<Playlist[]> => {
    return await ipcRenderer.invoke('queryPlaylists')
  },
  getPlaylistImages: async (playlistID: number): Promise<string[]> => {
    return await ipcRenderer.invoke('getPlaylistImages', playlistID)
  },
  stopPlaylist: async () => {
    ipcRenderer.send('stopPlaylist')
  },
  deleteImageFromGallery: async (imageID: number, imageName: string) => {
    return await ipcRenderer.invoke(
      'deleteImageFromGallery',
      imageID,
      imageName
    )
  },
  deletePlaylist: async (playlistName: string) => {
    ipcRenderer.send('deletePlaylist', playlistName)
  },
  join: join,
  openContextMenu: (Image: Image) => {
    ipcRenderer.send('openContextMenuImage', Image)
  },
  updateSwwwConfig: (newConfig: swwwConfig) => {
    ipcRenderer.send('updateSwwwConfig', newConfig)
  },
  readSwwwConfig: async () => {
    return await ipcRenderer.invoke('readSwwwConfig')
  },
  readAppConfig: async (): Promise<AppConfigDB> => {
    return await ipcRenderer.invoke('readAppConfig')
  },
  updateAppConfig: (newAppConfig: AppConfigDB) => {
    ipcRenderer.send('updateAppConfig', newAppConfig)
  },
  readActivePlaylist: () => {
    return ipcRenderer.invoke('readActivePlaylist') as Promise<
      ActivePlaylist | undefined
    >
  },
  onClearPlaylist: (callback: () => void) => {
    ipcRenderer.on('clearPlaylist', callback)
  },
  exitApp: () => {
    ipcRenderer.send('exitApp')
  },
  thumbnailDirectory: appDirectories.thumbnails,
  imagesDirectory: appDirectories.imagesDir
}
export type ELECTRON_API_TYPE = typeof ELECTRON_API
