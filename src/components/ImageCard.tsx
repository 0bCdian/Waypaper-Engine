import { type FC } from 'react'
interface ImageCardProps {
  ImageName: string
}

export const ImageCard: FC<ImageCardProps> = ({ ImageName }) => {
  return (
   <div className='relative rounded-lg bg-zinc-500 w-80 drop-shadow '>
    <input type="checkbox" className='absolute top-0 right-0 m-2' />
    <img className='rounded-lg min-w-full' src={ImageName} alt="hola" />
    <p className='absolute rounded-lg bottom-0 p-6 w-full text-xs text-gray-50 bg-black bg-opacity-75'>{ImageName.split('/').at(-1)}</p>
  </div>
  )
}
