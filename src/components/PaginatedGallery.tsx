import { useState, useMemo, useEffect } from 'react'
import { useImages } from '../hooks/imagesStore'
import Skeleton from './Skeleton'
import ImageCard from './ImageCard'
import PlaylistTrack from './PlaylistTrack'
import { motion } from 'framer-motion'
import { debounce } from '../utils/utilities'
import ResponsivePagination from 'react-responsive-pagination'
import 'react-responsive-pagination/themes/minimal.css'
import '../custom.css'

function PaginatedGallery() {
  const { filteredImages, skeletonsToShow, filters } = useImages()
  const [imagesPerPage, setImagesPerPage] = useState(20)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const lastImageIndex = currentPage * imagesPerPage
  const firstImageIndex = lastImageIndex - imagesPerPage
  const totalPages = useMemo(() => {
    return Math.ceil(filteredImages.length / imagesPerPage)
  }, [filteredImages, skeletonsToShow, imagesPerPage])
  // this was calculated asuming a 300x200 thumbnail resolution
  const coeficient = 0.000010113
  const updateImagesPerPage = debounce(() => {
    const newDimensions = {
      width: window.innerWidth,
      height: window.innerHeight,
    }
    const newImagesPerPage = Math.ceil(
      coeficient * newDimensions.height * newDimensions.width,
    )
    setImagesPerPage(newImagesPerPage)
  }, 100)
  const SkeletonsArray = useMemo(() => {
    if (skeletonsToShow !== undefined) {
      return skeletonsToShow.fileNames.map((imageName, index) => {
        const imagePath = skeletonsToShow.imagePaths[index]
        return <Skeleton key={imagePath} imageName={imageName} />
      })
    }
    return []
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
        lastImageIndex,
      )
      return imagesToShow
    },
    [imagesPerPage, currentPage, totalPages, filteredImages, skeletonsToShow],
  )
  function handlePageChange(page: number) {
    setCurrentPage(page)
  }
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
    <div className=" transition flex flex-col justify-between sm:w-[90%] [max-height:87dvh] [min-height:87dvh] m-auto">
      <div className="overflow-y-scroll w-full scrollbar-thin m-auto">
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

      <div className="flex pt-3 flex-col w-full gap-5 ">
        <div className="w-[75%] self-center">
          <ResponsivePagination
            total={totalPages}
            previousClassName="rounded_button_previous"
            nextClassName="rounded_button_next"
            current={currentPage}
            onPageChange={(page: number) => handlePageChange(page)}
          />
        </div>
        <PlaylistTrack />
      </div>
    </div>
  )
}

export default PaginatedGallery
