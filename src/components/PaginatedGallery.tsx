import { useState, useMemo } from 'react'
import PaginatedGalleryNav from './PaginatedGalleryNav'
import { useImages } from '../hooks/imagesStore'
import Skeleton from './Skeleton'
import ImageCard from './ImageCard'
import PlaylistTrack from './PlaylistTrack'

const IMAGES_PER_PAGE = 20

function PaginatedGallery() {
  const { filteredImages, skeletonsToShow } = useImages()
  const [currentPage, setCurrentPage] = useState<number>(1)
  const lastImageIndex = currentPage * IMAGES_PER_PAGE
  const firstImageIndex = lastImageIndex - IMAGES_PER_PAGE
  const totalPages = useMemo(() => {
    return Math.ceil(filteredImages.length / IMAGES_PER_PAGE)
  }, [filteredImages, skeletonsToShow])

  const SkeletonsArray = useMemo(() => {
    return skeletonsToShow.map((imageName, index) => (
      <Skeleton key={index} imageName={imageName} />
    ))
  }, [skeletonsToShow])
  const imagesCardArray = useMemo(() => {
    return filteredImages.map((image) => {
      return <ImageCard key={image.id} Image={image} />
    })
  }, [filteredImages])
  const imagesToShow = [...SkeletonsArray, ...imagesCardArray].slice(
    firstImageIndex,
    lastImageIndex
  )
  return (
    <div className='flex flex-col sm:w-[90%] m-auto h-[93vh]'>
      <div
        className='overflow-y-scroll w-full scrollbar-track-rounded-sm
              scrollbar-thumb-rounded-sm scrollbar-thin scrollbar-thumb-stone-400 m-auto'
      >
        <div className='md:grid flex flex-col w-full m-auto md:auto-cols-auto md:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]'>
          {imagesToShow}
        </div>
      </div>
      <div className='flex flex-col w-full gap-3'>
        <PaginatedGalleryNav
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          totalPages={totalPages}
        />
        <PlaylistTrack />
      </div>
    </div>
  )
}

export default PaginatedGallery
