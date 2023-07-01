import { type FC } from 'react'
interface SkeletonProps {
  imageName: string
}

export const Skeleton: FC<SkeletonProps> = ({ imageName }) => {
  return (
    <div className='relative rounded-lg bg-stone-800  h-[213.33px] w-[320px] drop-shadow '>
    <div className="h-[213.33px] w-[320px] p-3 overflow-hidden bg-gray-300 animate-pulse rounded-lg"></div>
    <p className='absolute rounded-b-lg  bottom-0 p-6 w-full text-lg text-justify text-ellipsis  bg-black bg-opacity-75'>{imageName.split('/').at(-1)}</p>
  </div>
  )
}
