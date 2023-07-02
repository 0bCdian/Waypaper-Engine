import { type FC } from 'react'
interface SkeletonProps {
  imageName: string
}

export const Skeleton: FC<SkeletonProps> = ({ imageName }) => {
  return (
    <div className='relative rounded-lg  bg-gray-200 animate-pulse drop-shadow '>
    <p className='absolute rounded-b-lg  bottom-0 p-6 w-full text-lg text-justify text-ellipsis  bg-black bg-opacity-75'>{imageName}</p>
  </div>
  )
}
