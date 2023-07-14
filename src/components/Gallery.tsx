import { ImageCard } from './ImageCard'
import { type FC, useState } from 'react'
import { Skeleton } from './Skeleton'
import { type ImagesArray } from '../types/rendererTypes'
import { AddImagesCard } from './AddImagesCard'
import Filters from './Filters'

import PlayListTrack from './PlaylistTrack'
interface GalleryProps {
  filePathList: ImagesArray
  skeletonsToShow: string[]
  setSkeletonsToShow: React.Dispatch<React.SetStateAction<string[]>>
  setImages: React.Dispatch<React.SetStateAction<ImagesArray>>
}

export const Gallery: FC<GalleryProps> = ({
  filePathList,
  skeletonsToShow,
  setSkeletonsToShow,
  setImages
}) => {
  const [searchFilter, setSearchFilter] = useState<string>('')

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
      <div>
        <Filters setSearchFilter={setSearchFilter} />
        <div className='overflow-y-auto scroll-smooth h-[84vh] scrollbar-track-rounded-sm scrollbar-thumb-rounded-sm scrollbar-thin scrollbar-track-transparent scrollbar-thumb-stone-100 w-[85%] m-auto  absolute top-24 left-40'>
          <div className='m-auto sm:grid sm:auto-cols-auto grid-cols-[repeat(auto-fill,minmax(300px,1fr))]'>
            <AddImagesCard
              setImages={setImages}
              setSkeletonsToShow={setSkeletonsToShow}
              alone={false}
            />
            {skeletons.length > 0 ? skeletons : ''}
            {imagesToShow}
          </div>
        </div>
        <PlayListTrack />
      </div>
    )
  }
  return (
    <div className='flex justify-center h-screen'>
      <div className='m-auto'>
        <AddImagesCard
          setImages={setImages}
          setSkeletonsToShow={setSkeletonsToShow}
          alone={true}
        />
      </div>
    </div>
  )
}
