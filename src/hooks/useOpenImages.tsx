import { create } from 'zustand'
import { Image, ImagesArray, imagesObject } from '../types/rendererTypes'
const { openFiles, handleOpenImages } = window.API_RENDERER

interface State {
  isActive: boolean
}
interface openImagesProps {
  setSkeletonsToShow: React.Dispatch<React.SetStateAction<string[]>>
  setImagesArray: React.Dispatch<React.SetStateAction<ImagesArray>>
  imagesArrayRef: React.MutableRefObject<ImagesArray>
  addImageToPlaylist: (Image: Image) => void
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
    addImageToPlaylist
  }) => {
    set(() => ({ isActive: true }))
    openFiles()
      .then((imagesObject: imagesObject) => {
        set(() => ({ isActive: false }))
        if (!imagesObject) return
        //@ts-ignore
        setSkeletonsToShow(imagesObject.fileNames.toReversed())
        handleOpenImages(imagesObject).then((data: ImagesArray) => {
          setImagesArray((prev: ImagesArray) => {
            const newData = [...prev, ...data]
            const copyData = structuredClone(data)
            const newImagesAdded = copyData.map((image) => {
              return { ...image, isChecked: true }
            })
            imagesArrayRef.current.push(...newImagesAdded)
            for (let i = newImagesAdded.length - 1; i >= 0; i--) {
              addImageToPlaylist(newImagesAdded[i])
            }
            setSkeletonsToShow([])
            return newData
          })
        })
      })
      .catch((error) => {
        console.error(error)
      })
  }
}))

export default openImagesStore
