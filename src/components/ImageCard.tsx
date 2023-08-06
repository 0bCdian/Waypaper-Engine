import { type FC, useId, ChangeEvent } from 'react'
import { Image } from '../types/rendererTypes'
import { playlistStore } from '../hooks/useGlobalPlaylist'
interface ImageCardProps {
  Image: Image
  modifyInputElement: (
    currentState: boolean,
    elementId?: number,
    elementName?: string
  ) => void
}
const { join, thumbnailDirectory, setImage, imagesDirectory } =
  window.API_RENDERER
export const ImageCard: FC<ImageCardProps> = ({
  Image,
  modifyInputElement
}) => {
  const id = useId()
  const imageNameFilePath =
    'atom://' +
    join(thumbnailDirectory, Image.imageName.split('.').at(0) + '.webp')
  const handleDoubleClick = () => {
    setImage(Image.imageName)
  }
  const { addImageToPlaylist, removeImageFromPlaylist } = playlistStore()
  const handleCheckboxChange = (event: ChangeEvent) => {
    const element = event.target as HTMLInputElement
    if (element.checked) {
      modifyInputElement(true, Image.id)
      addImageToPlaylist(Image)
    } else {
      modifyInputElement(false, Image.id)
      removeImageFromPlaylist(Image)
    }
  }
  return (
    <div
      onDoubleClick={handleDoubleClick}
      className='duration-500 border-[2px] border-transparent group hover:border-info relative rounded-lg bg-transparent max-w-fit mb-4 overflow-hidden '
    >
      <div className='relative'>
        <label
          htmlFor={id}
          className='absolute z-10 w-full h-10 opacity-0 cursor-pointer'
        ></label>
        <input
          id={id}
          checked={Image.isChecked}
          onChange={handleCheckboxChange}
          type='checkbox'
          className='absolute opacity-0 top-2 right-2 rounded-sm group-hover:opacity-100 checked:opacity-100  z-20 checkbox checkbox-sm checkbox-success group-hover:bg-success'
        />
      </div>
      <img
        className='rounded-lg transform-gpu group-hover:scale-110 group-hover:object-center transition-all duration-300'
        src={imageNameFilePath}
        alt={Image.imageName}
        draggable={false}
        onError={({ currentTarget }) => {
          currentTarget.onerror = null
          currentTarget.className =
            'rounded-lg min-w-full max-w-[300px] object-fill'
          currentTarget.src = 'atom://' + join(imagesDirectory, Image.imageName)
        }}
      />
      <p className='absolute rounded-b-lg bottom-0 pl-2 p-2 w-full text-lg text-justify text-ellipsis overflow-hidden bg-black bg-opacity-75 font-medium truncate '>
        {Image.imageName}
      </p>
    </div>
  )
}
