import { create } from 'zustand'
import { ImagesArray, imagesObject } from '../types/rendererTypes'
const { openFiles, handleOpenImages } = window.API_RENDERER

interface State {
  isActive: boolean
}
interface openImagesProps {
  setSkeletons: (skeletons: string[]) => void
  setImagesArray: (imagesArray: ImagesArray) => void
  addMultipleImagesToPlaylist: (Images: ImagesArray) => void
}

interface Actions {
  openImages: ({}: openImagesProps) => Promise<void>
}

const openImagesStore = create<State & Actions>((set) => ({
  isActive: false,
  openImages: async ({
    setSkeletons,
    setImagesArray,
    addMultipleImagesToPlaylist
  }) => {
    set(() => ({ isActive: true }))
    const imagesObject: imagesObject = await openFiles()
    imagesObject.fileNames.reverse()
    imagesObject.imagePaths.reverse()
    set(() => ({ isActive: false }))
    if (!imagesObject) return
    //@ts-ignore
    setSkeletons(imagesObject.fileNames)
    const imagesArray: ImagesArray = await handleOpenImages(imagesObject)
    const newImagesAdded = imagesArray.map((image) => {
      return { ...image, isChecked: true }
    })
    setSkeletons([])
    setImagesArray(newImagesAdded)
    addMultipleImagesToPlaylist(newImagesAdded)
  }
}))

export default openImagesStore
