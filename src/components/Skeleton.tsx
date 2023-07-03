import { type FC } from 'react'
interface SkeletonProps {
  imageName: string
}

export const Skeleton: FC<SkeletonProps> = ({ imageName }) => {
  return (
    <div className='relative rounded-lg  bg-gray-200 animate-pulse drop-shadow min-h-[199.00px] max-w-[300px] '>
      <p className='absolute rounded-b-lg bottom-0 p-3 w-full text-lg text-justify text-ellipsis bg-secondary_main bg-opacity-95 overflow-hidden'>
        {imageName}
      </p>
    </div>
  )
}
