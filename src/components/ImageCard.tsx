import { type FC, useId, useState, ChangeEvent, useEffect } from 'react'
import { Image } from '../types/rendererTypes'
interface ImageCardProps {
  Image: Image
  shouldClear: boolean
  addImageToPlaylist: (Image: Image) => void
  removeImageFromPlaylist: (Image: Image) => void
  modifyInputElement: (elementId: number, currentState: boolean) => void
}
const { join, thumbnailDirectory, setImage, imagesDirectory } =
  window.API_RENDERER
export const ImageCard: FC<ImageCardProps> = ({
  Image,
  addImageToPlaylist,
  removeImageFromPlaylist,
  modifyInputElement,
  shouldClear
}) => {
  const [isChecked, setIsChecked] = useState<boolean>(Image.isChecked)
  const id = useId()
  const imageNameFilePath =
    'atom://' +
    join(thumbnailDirectory, Image.imageName.split('.').at(0) + '.webp')
  const handleDoubleClick = () => {
    setImage(Image.imageName)
  }
  useEffect(() => {
    console.log('useEffect')
    if (shouldClear) {
      console.log('shouldClear')
      setIsChecked(false)
      modifyInputElement(Image.id, false)
    }
  }, [shouldClear])
  const handleCheckboxChange = (event: ChangeEvent) => {
    const element = event.target as HTMLInputElement
    if (element.checked) {
      setIsChecked(true)
      modifyInputElement(Image.id, true)
      addImageToPlaylist(Image)
    } else {
      modifyInputElement(Image.id, false)
      setIsChecked(false)
      removeImageFromPlaylist(Image)
    }
  }
  return (
    <div
      onDoubleClick={handleDoubleClick}
      className='cursor-pointer transition-all border-[3px] border-transparent group hover:border-cyan-300 relative rounded-lg bg-transparent shadow-2xl  max-w-fit mb-4 overflow-hidden'
    >
      <div className='relative'>
        <label
          htmlFor={id}
          className=' absolute z-10 w-full h-10 opacity-0'
        ></label>
        <input
          id={id}
          checked={isChecked}
          onChange={handleCheckboxChange}
          type='checkbox'
          className='absolute opacity-0 top-2 right-2 w-4 h-4 rounded-sm outline-none  group-hover:opacity-100 checked:opacity-100 checked:border-0 z-20'
        />
      </div>
      <img
        className='rounded-lg min-w-full transform-gpu group-hover:scale-110 group-hover:object-center : transition-all'
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
      <p className='absolute rounded-b-lg bottom-0 pl-2 p-1 w-full text-lg text-justify text-ellipsis overflow-hidden bg-gradient-to-t from-black from-10% text-stone-100 font-medium '>
        {Image.imageName}
      </p>
    </div>
  )
}
