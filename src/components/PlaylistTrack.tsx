import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove
} from '@dnd-kit/sortable'
import { FC, useState } from 'react'
import { ImagesArray } from '../types/rendererTypes'
import MiniPlaylistCard from './MiniPlaylistCard'

interface PlaylistTrackProps {
  imagesInPlaylist: ImagesArray
  movePlaylistArrayOrder: (newlyOrderedArray: ImagesArray) => void
  clearPlaylist: () => void
}

const PlaylistTrack: FC<PlaylistTrackProps> = ({
  imagesInPlaylist,
  movePlaylistArrayOrder,
  clearPlaylist
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
  return (
    <div className='absolute bottom-0 bg-black'>
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          strategy={horizontalListSortingStrategy}
          items={imagesInPlaylist}
        >
          <div className='flex'>
            {imagesInPlaylist?.map((image) => {
              return (
                <MiniPlaylistCard
                  key={image.id}
                  imageName={image.imageName}
                  id={image.id}
                />
              )
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
export default PlaylistTrack
