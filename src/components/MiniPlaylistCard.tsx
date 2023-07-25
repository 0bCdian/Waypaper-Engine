import { useSortable } from '@dnd-kit/sortable'
import { motion } from 'framer-motion'
import { CSS } from '@dnd-kit/utilities'
import { useEffect, useRef } from 'react'

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
      setTimeout(() => {
        if (imageRef.current) {
          imageRef.current.scrollIntoView({ behavior: 'smooth' })
        }
      }, 200)
    }
  }, [])

  return (
    <div ref={setNodeRef} style={style}>
        <motion.div
          initial={{ scale: 0.5 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.2 }}
          exit={{ scale: 0 }}
          className='w-32 m-1 shrink-0 rounded-lg shadow-xl'
        >
          <img
            {...attributes}
            {...listeners}
            src={imageSrc}
            alt={imageName}
            className='rounded-lg'
            ref={imageRef}
          />
        </motion.div>
    </div>
  )
}

export default MiniPlaylistCard
