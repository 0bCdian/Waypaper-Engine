import { type FC, useState, useMemo, useEffect, useRef } from 'react'
import PaginatedGalleryNav from './PaginatedGalleryNav'

const IMAGES_PER_PAGE = 20
interface PaginatedGalleryProps {
  imagesArray: JSX.Element[]
  SkeletonsArray: JSX.Element[]
}

const PaginatedGallery: FC<PaginatedGalleryProps> = ({
  imagesArray,
  SkeletonsArray
}) => {
  const [currentPage, setCurrentPage] = useState<number>(1)
  const lastImageIndex = currentPage * IMAGES_PER_PAGE
  const firstImageIndex = lastImageIndex - IMAGES_PER_PAGE
  const totalPages = useMemo(() => {
    return Math.ceil(imagesArray.length / IMAGES_PER_PAGE)
  }, [imagesArray])
  const imagesToShow = imagesArray.slice(firstImageIndex, lastImageIndex)

  const prevImagesArray = useRef<JSX.Element[]>([])
  const prevImagesToShow = useRef<JSX.Element[]>([])

  useEffect(() => {
    setCurrentPage(1)
    prevImagesArray.current = imagesArray
  }, [imagesArray])
  useEffect(() => {
    prevImagesToShow.current = imagesToShow
  }, [currentPage])

  return (
    <div className='flex flex-col w-full overflow-hidden justify-between h-[100vh]'>
      <div
        className='overflow-y-scroll min-h-fit scroll-smooth w-full scrollbar-track-rounded-sm
          scrollbar-thumb-rounded-sm  scrollbar-thin scrollbar-thumb-transparent m-auto my-3'
      >
        <div className='md:grid flex flex-col items-center w-full m-auto md:auto-cols-auto md:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]'>
          {imagesToShow.map((image, index) => (
            <div key={index} className='image-container'>
              {image}
            </div>
          ))}
          {SkeletonsArray}
        </div>
      </div>
      <PaginatedGalleryNav
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        totalPages={totalPages}
      />
    </div>
  )
}

export default PaginatedGallery
