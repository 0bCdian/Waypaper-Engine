import { ipcRenderer } from 'electron'
import { appDirectories } from './globals/globals'

export const ELECTRON_API = {
  // This method is for getting the names of the images selected to generate skeletons
  addNewImages: async () => await ipcRenderer.invoke('addNewImages'),
  getImagesFromCache: async () => {
    const imagesFromCache = await ipcRenderer.invoke('getImagesFromCache')
    return imagesFromCache
  },
  cacheThumbnailDirectory: appDirectories.thumbnails
}
export type ELECTRON_API_TYPE = typeof ELECTRON_API
