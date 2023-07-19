import { useState, type FC } from 'react'
import SvgComponent from './addImagesIcon'
import { ImagesArray, imagesObject } from '../types/rendererTypes'

interface AddImagesCardProps {
  alone: boolean
  setSkeletonsToShow: React.Dispatch<React.SetStateAction<string[]>>
  setImagesArray: React.Dispatch<React.SetStateAction<ImagesArray>>
  imagesArrayRef: React.MutableRefObject<ImagesArray>
}

export const AddImagesCard: FC<AddImagesCardProps> = ({
  alone,
  setSkeletonsToShow,
  setImagesArray,
  imagesArrayRef
}) => {
  const [isActive, setActiveState] = useState<boolean>(true)
  const openFiles = (): void => {
    setActiveState(false)
    window.API_RENDERER.openFiles()
      .then((imagesObject: imagesObject) => {
        setActiveState(true)
        setSkeletonsToShow(imagesObject.fileNames)
        window.API_RENDERER.handleOpenImages(imagesObject).then(() => {
          window.API_RENDERER.queryImages().then((data) => {
            setImagesArray(data)
            imagesArrayRef.current = data
            setSkeletonsToShow([])
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
    <div className={styles} onClick={isActive ? openFiles : undefined}>
      <div className=' flex justify-center  rounded-lg min-w-[300px] min-h-[200px]'>
        <SvgComponent />
      </div>
      <p className='absolute top-[65%] left-[35%] font-bold text-[#ebdbb2]'>
        Add images
      </p>
    </div>
  )
}
