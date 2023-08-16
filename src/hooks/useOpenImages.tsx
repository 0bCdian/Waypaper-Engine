import { create } from 'zustand'
import { Image, imagesObject } from '../types/rendererTypes'
const { openFiles, handleOpenImages } = window.API_RENDERER

interface State {
  isActive: boolean
}
interface openImagesProps {
  setSkeletons: (skeletons: string[]) => void
  setImagesArray: (imagesArray: Image[]) => void
  addMultipleImagesToPlaylist: (Images: Image[]) => void
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
    set(() => ({ isActive: false }))
    if (!imagesObject) return
    imagesObject.fileNames.reverse()
    imagesObject.imagePaths.reverse()
    //@ts-ignore
    setSkeletons(imagesObject.fileNames)
    const imagesArray: Image[] = await handleOpenImages(imagesObject)
    const newImagesAdded = imagesArray.map((image) => {
      return { ...image, isChecked: true }
    })
    setSkeletons([])
    setImagesArray(newImagesAdded)
    addMultipleImagesToPlaylist(newImagesAdded)
  }
}))

export default openImagesStore
