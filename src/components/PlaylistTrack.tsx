import { DndContext, DragEndEvent, closestCorners } from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove
} from '@dnd-kit/sortable'
import {
  restrictToFirstScrollableAncestor,
  restrictToHorizontalAxis
} from '@dnd-kit/modifiers'
import { useMemo, useEffect, useRef } from 'react'
import MiniPlaylistCard from './MiniPlaylistCard'
import playlistStore from '../hooks/playlistStore'
import openImagesStore from '../hooks/useOpenImages'
import { motion, AnimatePresence } from 'framer-motion'
import { useImages } from '../hooks/imagesStore'
import { Image, openFileAction } from '../types/rendererTypes'
const { stopPlaylist } = window.API_RENDERER
function PlaylistTrack() {
  const {
    playlist,
    movePlaylistArrayOrder,
    addMultipleImagesToPlaylist,
    addImageToPlaylist,
    clearPlaylist,
    readPlaylist
  } = playlistStore()
  const { openImages, isActive } = openImagesStore()
  const { setSkeletons, setImagesArray, resetImageCheckboxes, reQueryImages } =
    useImages()
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
  const handleClickAddImages = (action: openFileAction) => {
    openImages({
      setSkeletons,
      setImagesArray,
      addMultipleImagesToPlaylist,
      addImageToPlaylist,
      currentPlaylist: readPlaylist(),
      action
    })
  }
  let sortingCriteria: number[] = []
  const reorderSortingCriteria = () => {
    //@ts-ignore
    const newArray = playlist.images.toSorted((a: Image, b: Image) => {
      if (a.time < b.time) {
        return -1
      }
      if (a.time > b.time) {
        return 1
      }
      return 0
    })
    movePlaylistArrayOrder(newArray)
  }
  const playlistArray = useMemo(() => {
    const lastIndex = playlist.images.length - 1
    const elements = playlist.images.map((Image, index) => {
      sortingCriteria.push(Image.id)
      return (
        <MiniPlaylistCard
          isLast={lastIndex === index}
          reorderSortingCriteria={reorderSortingCriteria}
          playlistType={playlist.configuration.playlistType}
          index={index}
          Image={Image}
          key={Image.id}
        />
      )
    })
    return elements
  }, [playlist.images, playlist.configuration])
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    if (playlist.images.length === 0) {
      resetImageCheckboxes()
      reQueryImages()
      clearPlaylist()
    }
  }, [playlist.images])

  return (
    <div className='w-full flex flex-col gap-2 mb-2'>
      <div className='flex justify-between items-center mb-2'>
        <div className='flex gap-5 items-center '>
          <span className='text-4xl font-bold'>
            {playlistArray.length > 0
              ? `Playlist (${playlistArray.length})`
              : 'Playlist'}
          </span>
          <div className='dropdown dropdown-top'>
            <div
              tabIndex={0}
              role='button'
              className='btn btn-primary rounded-lg m-1'
            >
              Add images
            </div>
            <ul
              tabIndex={0}
              className='dropdown-content mb-1 bg-base-100 z-[10] menu p-2 shadow  rounded-box w-52'
            >
              <li>
                <a
                  className='text-lg text-base-content'
                  onClick={
                    isActive
                      ? undefined
                      : () => {
                          handleClickAddImages('file')
                        }
                  }
                >
                  Individual images
                </a>
              </li>
              <li>
                <a
                  className='text-lg text-base-content'
                  onClick={
                    isActive
                      ? undefined
                      : () => {
                          handleClickAddImages('folder')
                        }
                  }
                >
                  Image directory
                </a>
              </li>
            </ul>
          </div>
          <button
            onClick={() => {
              // @ts-ignore
              window.LoadPlaylistModal.showModal()
            }}
            className='btn btn-primary rounded-lg'
          >
            Load Playlist
          </button>

          <AnimatePresence mode='sync'>
            {playlist.images.length > 1 && (
              <>
                <div
                  className='tooltip tooltip-success'
                  data-tip='Save Playlist'
                >
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
                    Save
                  </motion.button>
                </div>
                <div
                  className='tooltip tooltip-success'
                  data-tip='Configure Playlist'
                >
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
                    Configure
                  </motion.button>
                </div>
              </>
            )}
          </AnimatePresence>
        </div>
        <AnimatePresence>
          {playlist.images.length > 1 && (
            <div
              className='tooltip tooltip-success'
              data-tip={`Clears and stops "${playlist.name}"`}
            >
              <motion.button
                initial={{ y: 100, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className='btn btn-error rounded-lg'
                onClick={() => {
                  resetImageCheckboxes()
                  clearPlaylist()
                  stopPlaylist()
                }}
              >
                Clear
              </motion.button>
            </div>
          )}
        </AnimatePresence>
      </div>
      <DndContext
        modifiers={[
          restrictToHorizontalAxis,
          restrictToFirstScrollableAncestor
        ]}
        autoScroll={true}
        collisionDetection={closestCorners}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          strategy={horizontalListSortingStrategy}
          items={sortingCriteria}
        >
          <AnimatePresence initial={false}>
            {playlistArray.length > 0 && (
              <motion.div
                initial={{ opacity: 0.5, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                exit={{ scale: 0, opacity: 0 }}
                className='flex rounded-lg  overflow-y-clip [max-height:fit] max-w-[90vw] overflow-x-scroll scrollbar-track-rounded-sm scrollbar-thumb-rounded-sm scrollbar-thin scrollbar-thumb-neutral-300'
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
