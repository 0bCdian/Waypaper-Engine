import { useId, ChangeEvent } from 'react'
import { Image } from '../types/rendererTypes'
import playlistStore from '../hooks/playlistStore'
import { useImages } from '../hooks/imagesStore'
import { motion } from 'framer-motion'
interface ImageCardProps {
  Image: Image
}
const {
  join,
  thumbnailDirectory,
  setImage,
  imagesDirectory,
  deleteImageFromGallery,
  openContextMenu
} = window.API_RENDERER
function ImageCard({ Image }: ImageCardProps) {
  const id = useId()
  const { removeImageFromStore } = useImages()
  const imageNameFilePath = `atom://${join(
    thumbnailDirectory,
    `${Image.name.split('.').at(0)}.webp`
  )}`
  const handleDoubleClick = () => {
    setImage(Image.name)
  }
  const { addImageToPlaylist, removeImageFromPlaylist } = playlistStore()
  const handleCheckboxChange = (event: ChangeEvent) => {
    const element = event.target as HTMLInputElement
    if (element.checked) {
      Image.isChecked = true
      addImageToPlaylist(Image)
    } else {
      Image.isChecked = false
      removeImageFromPlaylist(Image)
    }
  }
  const handleDeleteFromGallery = (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    e.preventDefault()
    const confirmDeletion = window.confirm(
      `Are you sure you want to delete ${Image.name} from gallery?`
    )
    if (confirmDeletion) {
      deleteImageFromGallery(Image.id, Image.name).then(
        (isDeleted: boolean) => {
          if (isDeleted) {
            removeImageFromStore(Image.id)
            removeImageFromPlaylist(Image)
          }
        }
      )
    }
  }
  const handleRightClick = () => {
    openContextMenu(Image.name)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onContextMenu={handleRightClick}
      className='duration-500 border-[2px] border-transparent group hover:border-info relative rounded-lg bg-transparent max-w-fit mb-4 overflow-hidden '
    >
      <div className='relative'>
        <button
          onClick={handleDeleteFromGallery}
          className='absolute z-10 top-1 left-1 rounded-md transition-all opacity-0 hover:bg-error hover:opacity-100 cursor-default'
        >
          <svg
            xmlns='http://www.w3.org/2000/svg'
            className='h-5 w-5'
            fill='none'
            viewBox='0 0 24 24'
            stroke='#F3D8D2'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth='3'
              d='M6 18L18 6M6 6l12 12'
            />
          </svg>
        </button>
        <input
          id={id}
          checked={Image.isChecked}
          onChange={handleCheckboxChange}
          type='checkbox'
          className='absolute opacity-0 top-2 right-2 rounded-sm group-hover:opacity-100 checked:opacity-100  z-20 checkbox checkbox-sm checkbox-success group-hover:bg-success'
        />
      </div>
      <div onDoubleClick={handleDoubleClick}>
        <img
          className='rounded-lg transform-gpu group-hover:scale-110 group-hover:object-center transition-all duration-300'
          src={imageNameFilePath}
          alt={Image.name}
          draggable={false}
          loading='lazy'
          onError={({ currentTarget }) => {
            currentTarget.onerror = null
            currentTarget.className =
              'rounded-lg min-w-full max-w-[300px] object-fill'
            currentTarget.src = 'atom://' + join(imagesDirectory, Image.name)
          }}
        />
        <p className='absolute rounded-b-lg opacity-0 group-hover:opacity-100 duration-300 transition-all bottom-0 pl-2 p-2 w-full text-lg text-justify text-ellipsis overflow-hidden bg-black bg-opacity-75 font-medium truncate '>
          {Image.name}
        </p>
      </div>
    </motion.div>
  )
}

export default ImageCard
