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
import { useMemo, useEffect } from 'react'
import MiniPlaylistCard from './MiniPlaylistCard'
import playlistStore from '../hooks/useGlobalPlaylist'
import openImagesStore from '../hooks/useOpenImages'
import { motion, AnimatePresence } from 'framer-motion'
import { useImages } from '../hooks/imagesStore'

const { stopPlaylist } = window.API_RENDERER

function PlaylistTrack() {
  const {
    playlist,
    movePlaylistArrayOrder,
    addMultipleImagesToPlaylist,
    clearPlaylist
  } = playlistStore()
  const { openImages, isActive } = openImagesStore()
  const { setSkeletons, setImagesArray, resetImageCheckboxes } = useImages()
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
  const handleClickAddImages = () => {
    openImages({
      setSkeletons,
      setImagesArray,
      addMultipleImagesToPlaylist
    })
  }

  const playlistArray = useMemo(() => {
    const lastIndex = playlist.images.length - 1
    return playlist.images.map((image, index) => {
      return (
        <MiniPlaylistCard
          isLast={lastIndex === index}
          id={image.id}
          key={image.id}
          imageName={image.imageName}
        />
      )
    })
  }, [playlist.images])
  let firstRender = true
  useEffect(() => {
    if (firstRender) {
      firstRender = false
      return
    }
    if (playlist.images.length === 0) {
      resetImageCheckboxes()
      clearPlaylist()
      stopPlaylist()
    }
  }, [playlist.images])
  return (
    <div className='flex flex-col my-4'>
      <div className='flex justify-between gap-3 items-center my-2'>
        <div className='flex gap-5 items-center '>
          <span className='text-4xl font-bold'>
            {playlistArray.length > 0
              ? `Playlist (${playlistArray.length})`
              : 'Playlist'}
          </span>
          <button
            onClick={isActive ? undefined : handleClickAddImages}
            className='btn btn-primary rounded-lg'
          >
            Add images
          </button>
          <button
            onClick={() => {
              // @ts-ignore
              window.LoadPlaylistModal.showModal()
            }}
            className='btn btn-primary rounded-lg'
          >
            Load playlist
          </button>
          <AnimatePresence mode='sync'>
            {playlist.images.length > 1 && (
              <>
                <motion.button
                  initial={{ y: 100 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 100, opacity: 0 }}
                  onClick={() => {
                    // @ts-ignore
                    window.savePlaylistModal.showModal()
                  }}
                  className='btn btn-primary rounded-lg'
                >
                  Save playlist
                </motion.button>
                <motion.button
                  initial={{ y: 100 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 100, opacity: 0 }}
                  onClick={() => {
                    // @ts-ignore
                    window.playlistConfigurationModal.showModal()
                  }}
                  className='btn btn-primary rounded-lg'
                >
                  Configure playlist
                </motion.button>
              </>
            )}
          </AnimatePresence>
        </div>
        <AnimatePresence>
          {playlist.images.length > 1 && (
            <motion.button
              initial={{ y: 100, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className='btn btn-error rounded-lg'
              onClick={() => {
                resetImageCheckboxes()
                clearPlaylist()
              }}
            >
              Clear playlist
            </motion.button>
          )}
        </AnimatePresence>
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
          items={playlist.images}
        >
          <AnimatePresence initial={false}>
            {playlistArray.length > 0 && (
              <motion.div
                initial={{ opacity: 0.5, scale: 0.2 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ y: 300, opacity: 0 }}
                className='flex rounded-lg overflow-y-clip  overflow-x-scroll  scrollbar-track-rounded-sm scrollbar-thumb-rounded-sm scrollbar-thin scrollbar-thumb-neutral-300'
              >
                <AnimatePresence initial={false}>
                  {playlistArray}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </SortableContext>
      </DndContext>
    </div>
  )
}

export default PlaylistTrack
