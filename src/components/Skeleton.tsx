import { type FC } from 'react'
interface SkeletonProps {
  ImageName: string
}

export const Skeleton: FC<SkeletonProps> = ({ ImageName }) => {
  return (
    <div className='relative rounded-lg bg-zinc-500 w-80 drop-shadow '>
    <input type="checkbox" className='absolute top-0 right-0 m-2' />
    <div className="h-[213.33px] w-[320px] p-3 overflow-hidden bg-gray-500 animate-pulse"></div>
    <p className='absolute rounded-lg bottom-0 p-6 w-full text-xs text-gray-50 bg-black bg-opacity-75'>{ImageName.split('/').at(-1)}</p>
  </div>
  )
}
