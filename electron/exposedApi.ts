import { ipcRenderer } from 'electron'
import { appDirectories } from './globals/globals'
import { imagesObject, Monitor, Playlist, ActivePlaylist } from './types/types'
import { Image, rendererPlaylist } from '../src/types/rendererTypes'
import { join } from 'node:path'
import { swwwConfig } from './database/swwwConfig'
import { AppConfigDB } from '../src/routes/AppConfiguration'

export const ELECTRON_API = {
  openFiles: () => ipcRenderer.invoke('openFiles'),
  handleOpenImages: (imagesObject: imagesObject): Promise<Image[]> => {
    return ipcRenderer.invoke('handleOpenImages', imagesObject)
  },
  queryImages: () => {
    return ipcRenderer.invoke('queryImages')
  },
  setImage: (image: string) => {
    ipcRenderer.send('setImage', image)
  },
  setImageExtended: (image: Image, monitors: Monitor[]) => {
    ipcRenderer.send('setImageExtended', image, monitors)
  },
  savePlaylist: (playlistObject: rendererPlaylist) => {
    ipcRenderer.send('savePlaylist', playlistObject)
  },
  startPlaylist: (playlistName: string) => {
    ipcRenderer.send('startPlaylist', playlistName)
  },
  queryPlaylists: (): Promise<Playlist[]> => {
    return ipcRenderer.invoke('queryPlaylists')
  },
  getPlaylistImages: (playlistID: number): Promise<string[]> => {
    return ipcRenderer.invoke('getPlaylistImages', playlistID)
  },
  stopPlaylist: () => {
    ipcRenderer.send('stopPlaylist')
  },
  deleteImageFromGallery: (imageID: number, imageName: string) => {
    return ipcRenderer.invoke('deleteImageFromGallery', imageID, imageName)
  },
  deletePlaylist: (playlistName: string) => {
    ipcRenderer.send('deletePlaylist', playlistName)
  },
  openContextMenu: (Image: Image) => {
    ipcRenderer.send('openContextMenuImage', Image)
  },
  updateSwwwConfig: (newConfig: swwwConfig) => {
    ipcRenderer.send('updateSwwwConfig', newConfig)
  },
  readSwwwConfig: () => {
    return ipcRenderer.invoke('readSwwwConfig')
  },
  readAppConfig: (): Promise<AppConfigDB> => {
    return ipcRenderer.invoke('readAppConfig')
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
  onStartPlaylist: (
    callback: (event: Electron.IpcRendererEvent, ...args: any[]) => void
  ) => {
    ipcRenderer.on('startPlaylist', callback)
  },
  exitApp: () => {
    ipcRenderer.send('exitApp')
  },
  getMonitors: () => {
    return ipcRenderer.invoke('getMonitors') as Promise<Monitor[]>
  },
  join: join,
  thumbnailDirectory: appDirectories.thumbnails,
  imagesDirectory: appDirectories.imagesDir
}
export type ELECTRON_API_TYPE = typeof ELECTRON_API
