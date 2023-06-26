import { ImageCard } from './ImageCard'
import { type FC } from 'react'
import { Skeleton } from './Skeleton'
interface GalleryProps {
  filePathList: string[]
  skeletonsToShow: string[]
}

export const Gallery: FC<GalleryProps> = ({ filePathList, skeletonsToShow }) => {
  if (filePathList !== undefined) {
    const imagesToShow = filePathList.map((image) => {
      return <ImageCard key={image} ImageName={image}></ImageCard>
    })
    const skeletons = skeletonsToShow.map((skeletonFileName) => {
      return <Skeleton ImageName={skeletonFileName} key={skeletonFileName}></Skeleton>
    })

    return (
    <div className='grid grid-cols-5 gap-0 '>
   {skeletons.length > 0 ? skeletons : undefined}
    {imagesToShow}
    </div>
    )
  }
  return <h1>oh oh</h1>
}
