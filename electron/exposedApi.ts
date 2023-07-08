import { ipcRenderer } from 'electron'
import { appDirectories } from './globals/globals'
import { imagesObject } from './types/types'

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
  thumbnailDirectory: appDirectories.thumbnails,
  imagesDirectory: appDirectories.imagesDir
}
export type ELECTRON_API_TYPE = typeof ELECTRON_API
