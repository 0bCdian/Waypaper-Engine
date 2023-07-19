import { useRef, type FC, useId } from 'react'
interface ImageCardProps {
  imageName: string
}

export const ImageCard: FC<ImageCardProps> = ({ imageName }) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const id = useId()
  const imageNameFilePath =
    'atom://' +
    window.API_RENDERER.thumbnailDirectory +
    imageName.split('.').at(0) +
    '.webp'
  const setImage = () => {
    window.API_RENDERER.setImage(imageName)
  }

  return (
    <div
      draggable
      onDoubleClick={setImage}
      className='cursor-pointer transition-all border-[3px] border-transparent group hover:border-cyan-300 relative rounded-lg bg-transparent shadow-2xl  max-w-fit mb-4 overflow-hidden'
    >
      <div className='relative'>
        <label htmlFor={id} className=' absolute z-10 w-full h-10 opacity-0'>
          
        </label>
        <input
          id={id}
          type='checkbox'
          ref={inputRef}
          className='absolute opacity-0 top-2 right-2 w-4 h-4 rounded-sm outline-none  group-hover:opacity-100 checked:opacity-100 checked:border-0 z-20 '
        />
      </div>
      <img
        className='rounded-lg min-w-full transform-gpu group-hover:scale-110 group-hover:object-center : transition-all'
        src={imageNameFilePath}
        alt={imageName}
        onError={({ currentTarget }) => {
          currentTarget.onerror = null
          currentTarget.className =
            'rounded-lg min-w-full max-w-[300px] object-fill'
          currentTarget.src = `atom://${window.API_RENDERER.imagesDirectory}${imageName}`
        }}
      />
      <p className='absolute rounded-b-lg bottom-0 pl-2 p-1 w-full text-lg text-justify text-ellipsis overflow-hidden bg-gradient-to-t from-black from-10% text-stone-100 font-medium '>
        {imageName}
      </p>
    </div>
  )
}
