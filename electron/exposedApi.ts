import { ipcRenderer } from 'electron'
import { cacheDirectory } from './globals/globals'

export const ELECTRON_API = {
  // This method is for getting the names of the images selected to generate skeletons
  addNewImages: async () => await ipcRenderer.invoke('addNewImages'),
  getImagesFromCache: async () => {
    const imagesFromCache = await ipcRenderer.invoke('getImagesFromCache')
    return imagesFromCache
  },
  cacheThumbnailDirectory: cacheDirectory.thumbnails
}
export type ELECTRON_API_TYPE = typeof ELECTRON_API
