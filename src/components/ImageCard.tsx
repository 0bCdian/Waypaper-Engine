import { type FC } from 'react'
interface ImageCardProps {
  imageName: string
}

export const ImageCard: FC<ImageCardProps> = ({ imageName }) => {
  return (
   <div className='relative rounded-lg bg-transparent drop-shadow '>
    <input type="checkbox" className='absolute top-0 right-0 m-2' />
    <img className='rounded-lg min-w-full' src={imageName} alt={imageName} />
    <p className='absolute rounded-b-lg bottom-0 p-6 w-full text-lg text-justify text-ellipsis bg-secondary_main bg-opacity-95'>{imageName.split('/').at(-1)}</p>
  </div>
  )
}
