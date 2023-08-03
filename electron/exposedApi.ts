import { ipcRenderer } from 'electron'
import { appDirectories } from './globals/globals'
import { imagesObject } from './types/types'
import { playlist } from '../src/types/rendererTypes'
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
  savePlaylist: (playlistObject: playlist) => {
    ipcRenderer.send('savePlaylist', playlistObject)
  },
  join: join,
  thumbnailDirectory: appDirectories.thumbnails,
  imagesDirectory: appDirectories.imagesDir
}
export type ELECTRON_API_TYPE = typeof ELECTRON_API
