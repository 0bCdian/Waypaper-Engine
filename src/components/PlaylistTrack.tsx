import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove
} from '@dnd-kit/sortable'
import { FC, useEffect, useMemo } from 'react'
import { ImagesArray } from '../types/rendererTypes'
import MiniPlaylistCard from './MiniPlaylistCard'

interface PlaylistTrackProps {
  imagesInPlaylist: ImagesArray
  movePlaylistArrayOrder: (newlyOrderedArray: ImagesArray) => void
  clearPlaylist: () => void
  resetRef: () => void
}

const PlaylistTrack: FC<PlaylistTrackProps> = ({
  imagesInPlaylist,
  movePlaylistArrayOrder,
  clearPlaylist,
  resetRef
}) => {
  const handleDragEnd = (event: DragEndEvent) => {
    const { over, active } = event
    const oldindex = imagesInPlaylist.findIndex(
      (element) => element.id === active.id
    )
    const newIndex = imagesInPlaylist.findIndex(
      (element) => element.id === over?.id
    )
    const newArrayOrder = arrayMove(imagesInPlaylist, oldindex, newIndex)
    movePlaylistArrayOrder(newArrayOrder)
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
  useEffect(() => {
    if (imagesInPlaylist.length === 0) {
      resetRef()
    }
  }, [imagesInPlaylist])
  if (imagesInPlaylist.length === 0) {
    return (
      null
    )
  }
  return (
    <div className='overflow-y-hidden mt-3 scrollbar-track-rounded-sm scrollbar-thumb-rounded-sm scrollbar-thin scrollbar-track-transparent scrollbar-thumb-stone-100'>
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          strategy={horizontalListSortingStrategy}
          items={imagesInPlaylist}
        >
          <div className='flex'>
            <button
              onClick={() => {
                clearPlaylist()
                resetRef()
              }}
            >
              clearPlaylist
            </button>
            {playlistArray}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
export default PlaylistTrack
