import { useState } from 'react'
import { imagesObject, ImagesArray } from '../types/rendererTypes'
const { openFiles, handleOpenImages } = window.API_RENDERER

interface useOpenImagesProps {
  setSkeletonsToShow: React.Dispatch<React.SetStateAction<string[]>>
  setImagesArray: React.Dispatch<React.SetStateAction<ImagesArray>>
  imagesArrayRef: React.MutableRefObject<ImagesArray>
}

function useOpenImages({
  setImagesArray,
  setSkeletonsToShow,
  imagesArrayRef
}: useOpenImagesProps) {
  const [isActive, setActiveState] = useState<boolean>(true)
  const handleClick = (): void => {
    setActiveState(false)
    openFiles()
      .then((imagesObject: imagesObject) => {
        setActiveState(true)
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
  return { handleClick, isActive }
}

export default useOpenImages
