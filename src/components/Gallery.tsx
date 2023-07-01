import { ImageCard } from './ImageCard'
import { type FC } from 'react'
import { Skeleton } from './Skeleton'
import { type ImagesArray } from '../types/rendererTypes'
interface GalleryProps {
  filePathList: ImagesArray
  skeletonsToShow: string[]
}

export const Gallery: FC<GalleryProps> = ({ filePathList, skeletonsToShow }) => {
  if (filePathList !== undefined) {
    const imagesToShow = filePathList.map((image) => {
      return <ImageCard key={image.id} imageName={image.name}></ImageCard>
    })
    const skeletons = skeletonsToShow.map((skeletonFileName) => {
      return <Skeleton imageName={skeletonFileName} key={skeletonFileName}></Skeleton>
    })

    return (
    <div className='grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-2 '>
   {skeletons.length > 0 ? skeletons : undefined}
    {imagesToShow}
    </div>
    )
  }
  return <h1>No Images Loaded Yet</h1>
}
