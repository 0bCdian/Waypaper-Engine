import { useSortable } from '@dnd-kit/sortable'
import { useDndMonitor } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useEffect, useRef, MouseEvent } from 'react'

const { join, thumbnailDirectory } = window.API_RENDERER

const MiniPlaylistCard = ({
  imageName,
  id
}: {
  imageName: string
  id: number
}) => {
  const imageRef = useRef<HTMLImageElement>(null)
  const imageSrc =
    'atom://' + join(thumbnailDirectory, imageName.split('.').at(0) + '.webp')
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: id,
      transition: {
        duration: 250,
        easing: 'cubic-bezier(0.65, 1, 0, 1)'
      }
    })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }
  useEffect(() => {
    if (imageRef.current) {
      imageRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  return (
    <div
      {...attributes}
      {...listeners}
      ref={setNodeRef}
      style={style}
      className='w-32 m-1 shrink-0 rounded-lg shadow-xl'
    >
      <img
        src={imageSrc}
        alt={imageName}
        className='rounded-lg'
        ref={imageRef}
      />
    </div>
  )
}

export default MiniPlaylistCard
