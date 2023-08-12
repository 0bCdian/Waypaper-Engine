import { useImages } from '../hooks/imagesStore'
import AddImagesCard from './AddImagesCard'
import Filters from './Filters'
import PlaylistTrack from './PlaylistTrack'
import PaginatedGallery from './PaginatedGallery'

function Gallery() {
  const { isEmpty } = useImages()
  if (isEmpty) {
    return (
      <div className='flex justify-center h-screen'>
        <div className='m-auto'>
          <AddImagesCard />
        </div>
      </div>
    )
  }
  return (
    <div className='flex flex-col justify-between m-auto w-full sm:w-[85%] h-[100%] select-none'>
      <Filters />
      <PaginatedGallery />
      <PlaylistTrack />
    </div>
  )
}

export default Gallery
