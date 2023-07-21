import { ImageCard } from './ImageCard'
import { type FC, useState, useEffect, useRef } from 'react'
import { Skeleton } from './Skeleton'
import { type ImagesArray } from '../types/rendererTypes'
import { AddImagesCard } from './AddImagesCard'
import Filters from './Filters'
import PlaylistTrack from './PlaylistTrack'
import usePlaylist from '../hooks/usePlaylist'
export const Gallery: FC = () => {
  const [searchFilter, setSearchFilter] = useState<string>('')
  const [skeletonsToShow, setSkeletonsToShow] = useState<string[]>([])
  const [imagesArray, setImagesArray] = useState<ImagesArray>([])
  const imagesArrayRef = useRef<ImagesArray>(imagesArray)
  const {
    imagesInPlaylist,
    addImageToPlaylist,
    removeImageFromPlaylist,
    clearPlaylist,
    movePlaylistArrayOrder
  } = usePlaylist()
  useEffect(() => {
    window.API_RENDERER.queryImages().then((data) => {
      setImagesArray(data)
      setSkeletonsToShow([])
      imagesArrayRef.current = data
      clearPlaylist()
    })
  }, [])

  useEffect(() => {
    const newImagesArray = imagesArrayRef.current.filter((image) =>
      image.imageName
        .toLocaleLowerCase()
        .includes(searchFilter.toLocaleLowerCase())
    )
    setImagesArray(newImagesArray)
  }, [searchFilter])

  if (imagesArrayRef.current.length > 0 || skeletonsToShow.length > 0) {
    const imagesToShow = imagesArray
      .sort((a, b) => {
        return a.id > b.id ? -1 : 1
      })
      .map((image) => {
        return (
          <ImageCard
            key={image.id}
            addImageToPlaylist={addImageToPlaylist}
            removeImageFromPlaylist={removeImageFromPlaylist}
            Image={image}
          ></ImageCard>
        )
      })

    const skeletons = skeletonsToShow.map((skeletonFileName) => {
      return (
        <Skeleton
          imageName={skeletonFileName}
          key={skeletonFileName}
        ></Skeleton>
      )
    })
    return (
      <div>
        <Filters setSearchFilter={setSearchFilter} />
        <div className='overflow-y-auto scroll-smooth h-[84vh] scrollbar-track-rounded-sm scrollbar-thumb-rounded-sm scrollbar-thin scrollbar-track-transparent scrollbar-thumb-stone-100 w-[85%] m-auto  absolute top-24 left-40'>
          <div className='m-auto sm:grid sm:auto-cols-auto grid-cols-[repeat(auto-fill,minmax(300px,1fr))]'>
            <AddImagesCard
              imagesArrayRef={imagesArrayRef}
              setImagesArray={setImagesArray}
              setSkeletonsToShow={setSkeletonsToShow}
              alone={false}
            />
            {skeletons.length > 0 ? skeletons : ''}
            {imagesToShow}
          </div>
        </div>
        <PlaylistTrack
          imagesInPlaylist={imagesInPlaylist}
          clearPlaylist={clearPlaylist}
          movePlaylistArrayOrder={movePlaylistArrayOrder}
        />
      </div>
    )
  }
  return (
    <div className='flex justify-center h-screen'>
      <div className='m-auto'>
        <AddImagesCard
          imagesArrayRef={imagesArrayRef}
          setImagesArray={setImagesArray}
          setSkeletonsToShow={setSkeletonsToShow}
          alone={true}
        />
      </div>
    </div>
  )
}
