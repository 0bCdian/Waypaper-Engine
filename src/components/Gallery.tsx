import { ImageCard } from './ImageCard'
import { type FC } from 'react'
import { Skeleton } from './Skeleton'
import { type ImagesArray } from '../types/rendererTypes'
import { AddImagesCard } from './AddImagesCard'
interface GalleryProps {
  filePathList: ImagesArray
  skeletonsToShow: string[]
  onClick: () => void
}

export const Gallery: FC<GalleryProps> = ({
  filePathList,
  skeletonsToShow,
  onClick
}) => {
  if (filePathList.length > 0 || skeletonsToShow.length > 0) {
    const imagesToShow = filePathList
      .sort((a, b) => {
        return a.id > b.id ? -1 : 1
      })
      .map((image) => {
        return (
          <ImageCard key={image.id} imageName={image.imageName}></ImageCard>
        )
      })
    const skeletons = skeletonsToShow.map((skeletonFileName) => {
      return (
        <Skeleton
          imageName={skeletonFileName}
          key={skeletonFileName}
        ></Skeleton>
      )
    })
    return (
      <div className='overflow-y-scroll h-[100vh] scrollbar-track-rounded-sm scrollbar-thumb-rounded-sm scrollbar-thin scrollbar-track-stone-100 scrollbar-thumb-stone-800 w-[65%] max-[639px]:flex'>
        <div className='m-auto sm:grid sm:grid-cols-[repeat(auto-fit,minmax(300px,1fr))] sm:gap-1'>
          <AddImagesCard onClick={onClick} alone={false} />
          {skeletons.length > 0 ? skeletons : ''}
          {imagesToShow}
        </div>
      </div>
    )
  }
  return (
    <div className='flex justify-center h-screen'>
      <div className='m-auto'>
        <AddImagesCard onClick={onClick} alone={true} />
      </div>
    </div>
  )
}
