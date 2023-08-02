import { create } from 'zustand'
import { ImagesArray, imagesObject } from '../types/rendererTypes'
const { openFiles, handleOpenImages } = window.API_RENDERER

interface State {
  isActive: boolean
}
interface openImagesProps {
  setSkeletonsToShow: React.Dispatch<React.SetStateAction<string[]>>
  setImagesArray: React.Dispatch<React.SetStateAction<ImagesArray>>
  imagesArrayRef: React.MutableRefObject<ImagesArray>
  addMultipleImagesToPlaylist: (Images: ImagesArray) => void
}

interface Actions {
  openImages: ({}: openImagesProps) => Promise<void>
}

const openImagesStore = create<State & Actions>((set) => ({
  isActive: false,
  openImages: async ({
    setSkeletonsToShow,
    setImagesArray,
    imagesArrayRef,
    addMultipleImagesToPlaylist
  }) => {
    set(() => ({ isActive: true }))
    const imagesObject: imagesObject = await openFiles()
    set(() => ({ isActive: false }))
    if (!imagesObject) return
    //@ts-ignore
    setSkeletonsToShow(imagesObject.fileNames.toReversed())
    const imagesArray: ImagesArray = await handleOpenImages(imagesObject)
    setImagesArray((previousData: ImagesArray) => {
      const newData = [...previousData, ...imagesArray]
      return newData
    })
    setSkeletonsToShow([])
    const copyData = structuredClone(imagesArray)
    const newImagesAdded = copyData.map((image) => {
      return { ...image, isChecked: true }
    })
    imagesArrayRef.current.push(...newImagesAdded)
    addMultipleImagesToPlaylist(newImagesAdded)
  }
}))

export default openImagesStore
