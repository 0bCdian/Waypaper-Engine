import { type FC } from 'react'
interface SkeletonProps {
  imageName: string
}

export const Skeleton: FC<SkeletonProps> = ({ imageName }) => {
  return (
    <div className='relative rounded-lg shadow-2xl bg-gray-200 animate-pulse min-h-[199.00px] max-w-[300px] mb-4'>
      <p className='absolute rounded-b-lg bottom-0 pl-2 p-1 w-full text-lg text-justify text-ellipsis overflow-hidden bg-gradient-to-t from-black from-10% text-stone-100 font-medium '>
        {imageName}
      </p>
    </div>
  )
}
