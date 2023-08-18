import { useImages } from '../hooks/imagesStore'
import AddImagesCard from './AddImagesCard'
import PaginatedGallery from './PaginatedGallery'

function Gallery() {
  const { isEmpty } = useImages()
  if (!isEmpty) {
    return <PaginatedGallery />
  }
  return (
    <div className='flex justify-center'>
      <div className='m-auto'>
        <AddImagesCard />
      </div>
    </div>
  )
}

export default Gallery
