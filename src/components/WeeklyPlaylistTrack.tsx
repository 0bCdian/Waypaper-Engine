import { AnimatePresence, motion } from 'framer-motion'
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
import { useMemo } from 'react'
import MiniPlaylistCard from './MiniPlaylistCard'
import playlistStore from '../hooks/playlistStore'

const WeeklyPlaylistTrack = ({ weeklyPlaylist }) => {
  const {
    playlist,
    movePlaylistArrayOrder,
    addMultipleImagesToPlaylist,
    clearPlaylist,
    readPlaylist
  } = playlistStore()
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } })
  )
  const handleDragEnd = (event: DragEndEvent) => {
    const { over, active } = event
    if (!over) return
    if (over.id !== active.id) {
      const oldindex = playlist.images.findIndex(
        (element) => element.id === active.id
      )
      const newIndex = playlist.images.findIndex(
        (element) => element.id === over?.id
      )
      const newArrayOrder = arrayMove(playlist.images, oldindex, newIndex)
      movePlaylistArrayOrder(newArrayOrder)
    }
  }
  const playlistArray = useMemo(() => {
    const lastIndex = playlist.images.length - 1
    return playlist.images.map((Image, index) => {
      return (
        <MiniPlaylistCard
          isLast={lastIndex === index}
          Image={Image}
          key={Image.id}
        />
      )
    })
  }, [playlist.images])
  return (
    <DndContext
      modifiers={[restrictToHorizontalAxis, restrictToFirstScrollableAncestor]}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        strategy={horizontalListSortingStrategy}
        items={playlist.images.map((Image) => Image.id)}
      >
        <AnimatePresence initial={false}>
          {playlistArray.length > 0 && (
            <motion.div
              initial={{ opacity: 0.5, scale: 0.2 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ y: 300, opacity: 0 }}
              className='flex rounded-lg overflow-y-clip max-w-[90vw] overflow-x-scroll scrollbar-track-rounded-sm scrollbar-thumb-rounded-sm scrollbar-thin scrollbar-thumb-neutral-300'
            >
              <AnimatePresence initial={false}>{playlistArray}</AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </SortableContext>
    </DndContext>
  )
}

export default WeeklyPlaylistTrack
