import { DndContext, DragEndEvent, closestCorners } from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove
} from '@dnd-kit/sortable'
import { FC, useMemo } from 'react'
import MiniPlaylistCard from './MiniPlaylistCard'
import { playlistStore } from '../hooks/useGlobalPlaylist'
import { ImagesArray } from '../types/rendererTypes'
import openImagesStore from '../hooks/useOpenImages'

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
  if (imagesInPlaylist.length === 0) {
    return (
      <div className='flex justify-start align-middle gap-3 my-4'>
        <span className=' text-3xl'>Playlist</span>
        <button className='bg-[#007ACD] text-white font-medium px-2 py-1  rounded-md'>
          Load Playlist
        </button>
        <button className='bg-[#007ACD] text-white font-medium px-2 py-1  rounded-md'>
          Configure playlist
        </button>
        <button
          onClick={isActive ? undefined : handleClick}
          className='bg-[#007ACD] text-white font-medium px-2 py-1  rounded-md'
        >
          Add images
        </button>
      </div>
    )
  }
  return (
    <div className='mt-5'>
      <DndContext collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <SortableContext
          strategy={horizontalListSortingStrategy}
          items={imagesInPlaylist}
        >
          <div className='flex  justify-start align-middle gap-3 mb-4'>
            <span className=' text-3xl'>Playlist ({playlistArray.length})</span>
            <button
              className='bg-[#007ACD] text-white font-medium rounded-md px-2 py-1'
              onClick={() => {
                resetRef()
                clearPlaylist()
              }}
            >
              Clear playlist
            </button>
            <button className='bg-[#007ACD] text-white font-medium px-2 py-1  rounded-md'>
              Save playlist
            </button>
            <button className='bg-[#007ACD] text-white font-medium px-2 py-1  rounded-md'>
              Configure playlist
            </button>
          </div>

          <div className='flex overflow-y-hidden overflow-x-scroll scrollbar-track-rounded-sm scrollbar-thumb-rounded-sm scrollbar-thin scrollbar-thumb-stone-100 scrollbar-track-[#202020] '>
            {playlistArray}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}

export default PlaylistTrack
