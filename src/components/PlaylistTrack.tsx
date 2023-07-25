import {
  DndContext,
  DragEndEvent,
  MouseSensor,
  closestCenter,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove
} from '@dnd-kit/sortable'
import {
  restrictToFirstScrollableAncestor,
  restrictToHorizontalAxis
} from '@dnd-kit/modifiers'
import { FC, useMemo } from 'react'
import MiniPlaylistCard from './MiniPlaylistCard'
import { playlistStore } from '../hooks/useGlobalPlaylist'
import { ImagesArray } from '../types/rendererTypes'
import openImagesStore from '../hooks/useOpenImages'
import { motion, AnimatePresence } from 'framer-motion'

interface PlaylistTrackProps {
  clearPlaylist: () => void
  resetRef: () => void
  setSkeletonsToShow: React.Dispatch<React.SetStateAction<string[]>>
  setImagesArray: React.Dispatch<React.SetStateAction<ImagesArray>>
  imagesArrayRef: React.MutableRefObject<ImagesArray>
}

const PlaylistTrack: FC<PlaylistTrackProps> = ({
  clearPlaylist,
  resetRef,
  setSkeletonsToShow,
  setImagesArray,
  imagesArrayRef
}) => {
  const { imagesInPlaylist, movePlaylistArrayOrder } = playlistStore()
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } })
  )
  const handleDragEnd = (event: DragEndEvent) => {
    const { over, active } = event
    if (!over) return
    if (over.id !== active.id) {
      const oldindex = imagesInPlaylist.findIndex(
        (element) => element.id === active.id
      )
      const newIndex = imagesInPlaylist.findIndex(
        (element) => element.id === over?.id
      )
      const newArrayOrder = arrayMove(imagesInPlaylist, oldindex, newIndex)
      movePlaylistArrayOrder(newArrayOrder)
    }
  }
  const { openImages, isActive } = openImagesStore()
  const handleClick = () => {
    openImages({
      setSkeletonsToShow,
      setImagesArray,
      imagesArrayRef
    })
  }
  const playlistArray = useMemo(() => {
    return imagesInPlaylist.map((image) => {
      return (
        <MiniPlaylistCard
          id={image.id}
          key={image.id}
          imageName={image.imageName}
        />
      )
    })
  }, [imagesInPlaylist])
  return (
    <div className='flex flex-col  my-4'>
      <div className='flex justify-between align-middle gap-3 my-3'>
        <div className='flex gap-3'>
          <span className='text-3xl'>
            {playlistArray.length > 0
              ? `Playlist (${playlistArray.length})`
              : 'Playlist'}
          </span>
          <button className='bg-[#007ACD] text-white font-medium px-2 py-1  rounded-md active:scale-90 transition-all'>
            Save playlist
          </button>
          <button className='bg-[#007ACD] text-white font-medium px-2 py-1  rounded-md active:scale-90 transition-all'>
            Configure playlist
          </button>
          <button
            onClick={isActive ? undefined : handleClick}
            className='bg-[#007ACD] text-white font-medium px-2 py-1   rounded-md active:scale-90 transition-all'
          >
            Add images
          </button>
        </div>
        {imagesInPlaylist.length > 0 ? (
          <button
            className='bg-[#DB5453] text-white font-medium rounded-md px-2 py-1 active:scale-90 transition-all'
            onClick={() => {
              resetRef()
              clearPlaylist()
            }}
          >
            Clear playlist
          </button>
        ) : undefined}
      </div>

      <DndContext
        modifiers={[
          restrictToHorizontalAxis,
          restrictToFirstScrollableAncestor
        ]}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          strategy={horizontalListSortingStrategy}
          items={imagesInPlaylist}
        >
          <AnimatePresence initial={false}>
            {playlistArray.length > 0 ? (
              <motion.div
                initial={{ opacity: 0.5, scale: 0.2 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0.2, scale: 0.5 }}
                className='flex rounded-lg overflow-y-clip  overflow-x-scroll  scrollbar-track-rounded-sm scrollbar-thumb-rounded-sm scrollbar-thin scrollbar-thumb-stone-400 scrollbar-track-[#202020]'
              >
                <AnimatePresence initial={false}> {playlistArray}</AnimatePresence>
              </motion.div>
            ) : undefined}
          </AnimatePresence>
        </SortableContext>
      </DndContext>
    </div>
  )
}

export default PlaylistTrack
