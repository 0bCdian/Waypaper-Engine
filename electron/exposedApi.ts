import { ipcRenderer } from 'electron'
import { appDirectories } from './globals/globals'
import { imagesObject, Playlist } from './types/types'
import { rendererPlaylist } from '../src/types/rendererTypes'
import { join } from 'node:path'

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
  thumbnailDirectory: appDirectories.thumbnails,
  imagesDirectory: appDirectories.imagesDir
}
export type ELECTRON_API_TYPE = typeof ELECTRON_API
