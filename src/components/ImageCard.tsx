import { useRef, type FC, useState, useEffect } from 'react'
interface ImageCardProps {
  imageName: string
}

export const ImageCard: FC<ImageCardProps> = ({ imageName }) => {
  const [isChecked, setChecked] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const imageNameFilePath =
    'atom://' +
    window.API_RENDERER.thumbnailDirectory +
    imageName.split('.').at(0) +
    '.webp'
  const setImage = () => {
    window.API_RENDERER.setImage(imageName)
  }
  useEffect(() => {
    if (isChecked) {
      if (inputRef.current !== null) {
        inputRef.current.className = baseStyle + ' opacity-100'
      }
    } else {
      if (inputRef.current !== null) {
        inputRef.current.className = baseStyle + ' opacity-0'
      }
    }
  }, [isChecked])
  const baseStyle =
    'absolute group-hover:opacity-100 z-10 right-2 top-1 rounded-2xl transition-all duration-500'
  return (
    <div
      draggable
      onDoubleClick={setImage}
      className='transition-all border-[3px] border-transparent group hover:border-cyan-300 relative rounded-lg bg-transparent shadow-2xl  max-w-fit mb-4 overflow-hidden'
    >
      <input
        type='checkbox'
        ref={inputRef}
        className='absolute opacity-0 group-hover:opacity-100 z-10 right-2 top-1 rounded-2xl transition-all duration-500'
        onChange={() => {
          setChecked((previousValue) => !previousValue)
        }}
      />
      <img
        className='rounded-lg min-w-full transform-gpu group-hover:scale-110 group-hover:object-center active:scale-90 : transition-all'
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
