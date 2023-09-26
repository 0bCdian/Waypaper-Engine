import { useState, useMemo } from 'react'
import PaginatedGalleryNav from './PaginatedGalleryNav'
import { useImages } from '../hooks/imagesStore'
import Skeleton from './Skeleton'
import ImageCard from './ImageCard'
import PlaylistTrack from './PlaylistTrack'
import { motion } from 'framer-motion'

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
    <div className='flex flex-col sm:w-[90%] [max-height:92vh] [min-height:92vh] m-auto'>
      <div className='overflow-y-scroll w-full scrollbar-thin m-auto'>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className='md:grid flex flex-col [min-height:full] w-full md:auto-cols-auto md:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]'
        >
          {imagesToShow}
        </motion.div>
      </div>
      <div className='flex mb-5 flex-col w-full gap-5'>
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
