import { DndContext, DragEndEvent, closestCorners } from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove
} from '@dnd-kit/sortable'
import { FC, useMemo } from 'react'
import MiniPlaylistCard from './MiniPlaylistCard'
import { playlistStore } from '../hooks/useGlobalPlaylist'

interface PlaylistTrackProps {
  clearPlaylist: () => void
  resetRef: () => void
}

const PlaylistTrack: FC<PlaylistTrackProps> = ({ clearPlaylist, resetRef }) => {
  const { imagesInPlaylist, movePlaylistArrayOrder } = playlistStore()
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
  if (imagesInPlaylist.length === 0) return null
  return (
    <div className=' overflow-y-clip h-[12%] my-3 scrollbar-track-rounded-sm scrollbar-thumb-rounded-sm scrollbar-thin scrollbar-track-transparent bg-black scrollbar-thumb-stone-100 touch-none'>
      <DndContext collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <SortableContext
          strategy={horizontalListSortingStrategy}
          items={imagesInPlaylist}
        >
          <div className='flex'>
            <button
              onClick={() => {
                console.log('clearing playlist')
                resetRef()
                clearPlaylist()
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
