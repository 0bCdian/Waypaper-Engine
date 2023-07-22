import { useState, type FC } from 'react'
import SvgComponent from './addImagesIcon'
import { ImagesArray, imagesObject } from '../types/rendererTypes'

interface AddImagesCardProps {
  alone: boolean
  setSkeletonsToShow: React.Dispatch<React.SetStateAction<string[]>>
  setImagesArray: React.Dispatch<React.SetStateAction<ImagesArray>>
  imagesArrayRef: React.MutableRefObject<ImagesArray>
}

const { openFiles, handleOpenImages } = window.API_RENDERER
export const AddImagesCard: FC<AddImagesCardProps> = ({
  alone,
  setSkeletonsToShow,
  setImagesArray,
  imagesArrayRef
}) => {
  const [isActive, setActiveState] = useState<boolean>(true)
  const handleClick = (): void => {
    setActiveState(false)
    openFiles()
      .then((imagesObject: imagesObject) => {
        setActiveState(true)
        //@ts-ignore
        setSkeletonsToShow(imagesObject.fileNames.toReversed())
        handleOpenImages(imagesObject).then((data) => {
          setImagesArray((prev) => {
            const newData = [...prev, ...data]
            imagesArrayRef.current = newData
            setSkeletonsToShow([])
            return newData
          })
        })
      })
      .catch((error) => {
        console.error(error)
      })
  }

  const styles = alone
    ? 'cursor-pointer relative rounded-lg max-w-fit mb-4 hover:bg-[#323232] active:scale-95 transition-all ease-in-out '
    : 'cursor-pointer relative rounded-lg bg-[#323232] hover:bg-[#424242] active:scale-95 transition-all max-w-fit mb-4'
  return (
    <div className={styles} onClick={isActive ? handleClick : undefined}>
      <div className=' flex justify-center  rounded-lg min-w-[300px] min-h-[200px]'>
        <SvgComponent />
      </div>
      <p className='absolute top-[65%] left-[35%] font-bold text-[#ebdbb2]'>
        Add images
      </p>
    </div>
  )
}
