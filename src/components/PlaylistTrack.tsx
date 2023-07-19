import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext } from '@dnd-kit/sortable'
import { useState, useRef } from 'react'

interface PlaylistTrackProps {
  imagesInPlaylist: string[]
}

function PlaylistTrack({ imagesInPlaylist }: PlaylistTrackProps) {
  const [imagesInPlaylist, setImagesInPlaylist] =
    useState<string[]>(imagesInPlaylist)
  const handleDragEnd = (event) => {}

  return (
    <div className='absolute bottom-0 left-52'>
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={}>
          <ul>
            <li>1</li>
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  )
}
export default PlaylistTrack
