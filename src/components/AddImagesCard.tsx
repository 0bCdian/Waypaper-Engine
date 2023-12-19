import SvgComponent from './addImagesIcon'
import SvgComponentFolder from './AddFoldersIcon'
import openImagesStore from '../hooks/useOpenImages'
import playlistStore from '../hooks/playlistStore'
import { useImages } from '../hooks/imagesStore'
import { openFileAction } from '../types/rendererTypes'

function AddImagesCard() {
  const { openImages, isActive } = openImagesStore()
  const { setSkeletons, setImagesArray } = useImages()
  const { addMultipleImagesToPlaylist, addImageToPlaylist, readPlaylist } =
    playlistStore()
  const handleOpenImages = (action: openFileAction) => {
    openImages({
      setSkeletons,
      setImagesArray,
      addMultipleImagesToPlaylist,
      addImageToPlaylist,
      currentPlaylist: readPlaylist(),
      action
    })
  }

  return (
    <div className='flex gap-20'>
      <div
        className='cursor-pointer relative rounded-lg max-w-fit hover:bg-[#323232] active:scale-95 transition-all ease-in-out'
        onClick={
          isActive
            ? undefined
            : () => {
                handleOpenImages('file')
              }
        }
      >
        <div className='flex justify-center rounded-lg min-w-[300px] min-h-[200px]'>
          <SvgComponent />
        </div>
        <p className='absolute top-[75%] left-[4rem] font-bold text-[#ebdbb2]'>
          Add individual images
        </p>
      </div>
      <div
        className='cursor-pointer  relative rounded-lg max-w-fit hover:bg-[#323232] active:scale-95 transition-all ease-in-out'
        onClick={
          isActive
            ? undefined
            : () => {
                handleOpenImages('folder')
              }
        }
      >
        <div className='flex justify-center mt-[4.1rem] rounded-lg min-w-[300px] '>
          <SvgComponentFolder />
        </div>
        <p className='absolute top-[75%] left-[3rem] font-bold text-[#ebdbb2]'>
          Add images from directory
        </p>
      </div>
    </div>
  )
}

export default AddImagesCard
