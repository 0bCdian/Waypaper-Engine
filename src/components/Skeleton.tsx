import { type FC } from 'react'
interface SkeletonProps {
  ImageName: string
}

export const Skeleton: FC<SkeletonProps> = ({ ImageName }) => {
  return (
    <div className='relative rounded-lg bg-stone-800  drop-shadow '>
    <input hidden type="checkbox" className='absolute top-0 right-0 m-2' />
    <div className="h-[213.33px] w-[320px] p-3 overflow-hidden bg-gray-300 animate-pulse"></div>
    <p className='absolute rounded-b-lg  bottom-0 p-6 w-full text-lg text-justify text-ellipsis  bg-black bg-opacity-75'>{ImageName.split('/').at(-1)}</p>
  </div>
  )
}
