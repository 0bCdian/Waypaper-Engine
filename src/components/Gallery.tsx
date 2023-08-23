import { useImages } from '../hooks/imagesStore'
import AddImagesCard from './AddImagesCard'
import PaginatedGallery from './PaginatedGallery'

function Gallery() {
  const { isEmpty } = useImages()
  return (
    <>
      {!isEmpty ? (
        <PaginatedGallery />
      ) : (
        <div className='flex justify-center items-center h-screen m-auto'>
          <div>
            <AddImagesCard />
          </div>
        </div>
      )}
    </>
  )
}

export default Gallery
