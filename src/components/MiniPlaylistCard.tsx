import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const { join, thumbnailDirectory } = window.API_RENDERER

const MiniPlaylistCard = ({
  imageName,
  id
}: {
  imageName: string
  id: number
}) => {
  const imageSrc =
    'atom://' + join(thumbnailDirectory, imageName.split('.').at(0) + '.webp')
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: id,
      transition: {
        duration: 150,
        easing: 'cubic-bezier(0.25, 1, 0.5, 1)'
      }
    })
    const style = {
      transform: CSS.Transform.toString(transform),
      transition
    }
   
  return (
    <div
      {...attributes}
      {...listeners}
      ref={setNodeRef}
      style={style}
      className='w-32 m-1 shrink-0 rounded-lg  shadow-lg'
    >
      <img src={imageSrc} alt={imageName} className='rounded-lg ' />
    </div>
  )
}

export default MiniPlaylistCard
