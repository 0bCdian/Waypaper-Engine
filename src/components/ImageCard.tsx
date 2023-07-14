import { type FC } from 'react'
interface ImageCardProps {
  imageName: string
}

export const ImageCard: FC<ImageCardProps> = ({ imageName }) => {
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
      onDoubleClick={setImage}
      className=' group relative rounded-lg bg-transparent shadow-2xl  max-w-fit mb-4 overflow-hidden'
    >
      <input type="checkbox" className='absolute ' />
      <img
        className='rounded-lg min-w-full transform-gpu group-hover:scale-110 group-hover:object-center transition-all'
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
