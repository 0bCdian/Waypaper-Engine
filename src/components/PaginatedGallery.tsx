import { useState, useMemo, useEffect } from 'react'
import PaginatedGalleryNav from './PaginatedGalleryNav'
import { useImages } from '../hooks/imagesStore'
import Skeleton from './Skeleton'
import ImageCard from './ImageCard'
import PlaylistTrack from './PlaylistTrack'
import { motion } from 'framer-motion'
import { debounce } from '../utils/utilities'

function PaginatedGallery() {
  const { filteredImages, skeletonsToShow, filters } = useImages()
  const [imagesPerPage, setImagesPerPage] = useState(20)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const lastImageIndex = currentPage * imagesPerPage
  const firstImageIndex = lastImageIndex - imagesPerPage
  const totalPages = useMemo(() => {
    return Math.ceil(filteredImages.length / imagesPerPage)
  }, [filteredImages, skeletonsToShow, imagesPerPage])

  const SkeletonsArray = useMemo(() => {
    return skeletonsToShow.map((imageName) => (
      <Skeleton key={imageName} imageName={imageName} />
    ))
  }, [skeletonsToShow])
  const imagesCardArray = useMemo(() => {
    return filteredImages.map((image) => {
      return <ImageCard key={image.id} Image={image} />
    })
  }, [filteredImages])
  const imagesToShow = useMemo(
    function () {
      const imagesToShow = [...SkeletonsArray, ...imagesCardArray].slice(
        firstImageIndex,
        lastImageIndex
      )
      return imagesToShow
    },
    [imagesPerPage, currentPage, totalPages, filteredImages, skeletonsToShow]
  )
  const updateImagesPerPage = debounce(() => {
    // this was calculated asuming a a 300x200 thumbnail resolution
    const coeficient = 0.000010113
    const newDimensions = {
      width: window.innerWidth,
      height: window.innerHeight
    }
    const newImagesPerPage = Math.ceil(
      coeficient * newDimensions.height * newDimensions.width
    )
    setImagesPerPage(newImagesPerPage)
  }, 100)

  useEffect(() => {
    window.addEventListener('resize', updateImagesPerPage)
  }, [])
  useEffect(() => {
    if (imagesToShow.length === 0) {
      setCurrentPage(totalPages)
    }
    if (filters.searchString === '') {
      setCurrentPage(1)
    }
  }, [imagesPerPage, totalPages, filters.searchString])

  return (
    <div className='flex flex-col sm:w-[90%] [max-height:87vh] [min-height:87vh] m-auto'>
      <div className='overflow-y-scroll w-full scrollbar-thin m-auto'>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`md:grid flex flex-col [min-height:full] w-fit  m-auto md:auto-cols-auto ${
            imagesToShow.length === 1
              ? 'items-center'
              : 'md:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] md:w-full'
          }`}
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
