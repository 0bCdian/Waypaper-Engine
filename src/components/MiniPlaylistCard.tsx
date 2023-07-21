import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Image } from '../types/rendererTypes'

const MiniPlaylistCard = ({ imageName, id }: Image) => {
  const imageSrc =
    'atom://' +
    window.API_RENDERER.thumbnailDirectory +
    imageName.split('.').at(0) +
    '.webp'
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }
  return (
    <div {...attributes} {...listeners} ref={setNodeRef} style={style} className='w-20 m-2'>
      <img src={imageSrc} alt={imageName} className=''/>
    </div>
  )
}

export default MiniPlaylistCard
