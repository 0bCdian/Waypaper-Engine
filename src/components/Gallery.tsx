import { ImageCard } from './ImageCard'
import { type FC, ChangeEvent, useState } from 'react'
import { Skeleton } from './Skeleton'
import { type ImagesArray } from '../types/rendererTypes'
import { AddImagesCard } from './AddImagesCard'
import Filters from './Filters'
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
  const [searchFilter, setSearchFilter] = useState<string>('')
  const onSearch = (event: ChangeEvent<HTMLInputElement>): void => {
    const target = event.target
    if (target !== null) {
      const text = target.value
      setSearchFilter(text)
    }
  }
  if (filePathList.length > 0 || skeletonsToShow.length > 0) {
    const imagesToShow = filePathList
      .filter((image) =>
        image.imageName
          .toLocaleLowerCase()
          .includes(searchFilter.toLocaleLowerCase())
      )
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
      <>
        <Filters onSearch={onSearch} />
        <div className='overflow-y-scroll h-[90vh] scrollbar-track-rounded-sm scrollbar-thumb-rounded-sm scrollbar-thin scrollbar-track-[#202020] scrollbar-thumb-stone-100 w-[85%] m-auto max-[639px]:flex shadow-2xl absolute top-24 left-40'>
          <div className='m-auto sm:grid sm:auto-cols-auto grid-cols-[repeat(auto-fill,minmax(300px,1fr))]'>
            <AddImagesCard onClick={onClick} alone={false} />
            {skeletons.length > 0 ? skeletons : ''}
            {imagesToShow}
          </div>
        </div>
      </>
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
