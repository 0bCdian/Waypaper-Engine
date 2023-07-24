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
}

interface Actions {
  openImages: ({}: openImagesProps) => void
}

const openImagesStore = create<State & Actions>((set) => ({
  isActive: false,
  openImages: ({ setSkeletonsToShow, setImagesArray, imagesArrayRef }) => {
    set(() => ({ isActive: true }))
    openFiles()
      .then((imagesObject: imagesObject) => {
        set(() => ({ isActive: false }))
        if (!imagesObject) return
        //@ts-ignore
        setSkeletonsToShow(imagesObject.fileNames.toReversed())
        handleOpenImages(imagesObject).then((data) => {
          setImagesArray((prev) => {
            const newData = [...prev, ...data]
            const copyData = structuredClone(data)
            imagesArrayRef.current.push(...copyData)
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
