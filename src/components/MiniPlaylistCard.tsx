import { useSortable } from '@dnd-kit/sortable'
import { motion } from 'framer-motion'
import { CSS } from '@dnd-kit/utilities'
import { useEffect, useRef } from 'react'
import { Image } from '../types/rendererTypes'
import playlistStore from '../hooks/playlistStore'

const { join, thumbnailDirectory } = window.API_RENDERER

function MiniPlaylistCard({
  Image,
  isLast
}: {
  Image: Image
  isLast: boolean | undefined
}) {
  const { removeImageFromPlaylist } = playlistStore()
  const imageRef = useRef<HTMLImageElement>(null)
  const imageSrc =
    'atom://' +
    join(thumbnailDirectory, Image.name.split('.').at(0) + '.webp')
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: Image.id,
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
    if (isLast) {
      imageRef.current?.scrollIntoView({ inline: 'start', behavior: 'smooth' })
    }
  }, [])
  const onRemove = () => {
    Image.isChecked = false
    removeImageFromPlaylist(Image)
  }
  return (
    <div ref={setNodeRef} style={style}>
      <motion.div
        initial={{ scale: 0.5 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.2 }}
        exit={{ scale: 0 }}
        className='w-32 mx-1 shrink-0 rounded-lg shadow-xl '
      >
        <div className='relative '>
          <button
            onClick={onRemove}
            className='absolute top-0 right-0 rounded-md transition-all opacity-0 hover:bg-error hover:opacity-100 cursor-default'
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              className='h-5 w-5'
              fill='none'
              viewBox='0 0 24 24'
              stroke='#F3D8D2'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth='3'
                d='M6 18L18 6M6 6l12 12'
              />
            </svg>
          </button>
        </div>
        <img
          {...attributes}
          {...listeners}
          src={imageSrc}
          alt={Image.name}
          className='rounded-lg cursor-move'
          ref={imageRef}
        />
      </motion.div>
    </div>
  )
}

export default MiniPlaylistCard
