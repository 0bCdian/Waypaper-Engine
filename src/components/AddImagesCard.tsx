import { type FC } from 'react'
import SvgComponent from './addImagesIcon'
import { ImagesArray } from '../types/rendererTypes'
import openImagesStore from '../hooks/useOpenImages'
import { playlistStore } from '../hooks/useGlobalPlaylist'

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
  const { openImages, isActive } = openImagesStore()
  const { addImageToPlaylist } = playlistStore()
  const handleClick = () => {
    openImages({
      setSkeletonsToShow,
      setImagesArray,
      imagesArrayRef,
      addImageToPlaylist
    })
  }
  const styles = alone
    ? 'cursor-pointer relative rounded-lg max-w-fit mb-4 hover:bg-[#323232] active:scale-95 transition-all ease-in-out '
    : 'cursor-pointer relative rounded-lg bg-[#323232] hover:bg-[#424242] active:scale-95 transition-all max-w-fit mb-4'
  return (
    <div className={styles} onClick={isActive ? undefined : handleClick}>
      <div className=' flex justify-center  rounded-lg min-w-[300px] min-h-[200px]'>
        <SvgComponent />
      </div>
      <p className='absolute top-[65%] left-[35%] font-bold text-[#ebdbb2]'>
        Add images
      </p>
    </div>
  )
}
