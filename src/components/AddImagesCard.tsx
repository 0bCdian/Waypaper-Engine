import SvgComponent from './addImagesIcon'
import openImagesStore from '../hooks/useOpenImages'
import playlistStore from '../hooks/playlistStore'
import { useImages } from '../hooks/imagesStore'

function AddImagesCard() {
  const { openImages, isActive } = openImagesStore()
  const { setSkeletons, setImagesArray } = useImages()
  const { addMultipleImagesToPlaylist } = playlistStore()
  const handleOpenImages = () => {
    openImages({
      setSkeletons,
      setImagesArray,
      addMultipleImagesToPlaylist
    })
  }

  return (
    <div
      className='cursor-pointer relative rounded-lg max-w-fit mb-4 hover:bg-[#323232] active:scale-95 transition-all ease-in-out'
      onClick={isActive ? undefined : handleOpenImages}
    >
      <div className='flex justify-center  rounded-lg min-w-[300px] min-h-[200px]'>
        <SvgComponent />
      </div>
      <p className='absolute top-[65%] left-[35%] font-bold text-[#ebdbb2]'>
        Add images
      </p>
    </div>
  )
}

export default AddImagesCard
