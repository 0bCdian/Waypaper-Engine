import { ImageCard } from './ImageCard'
import { type FC, useState, useEffect, useRef, useMemo } from 'react'
import { Skeleton } from './Skeleton'
import { type ImagesArray } from '../types/rendererTypes'
import { AddImagesCard } from './AddImagesCard'
import Filters from './Filters'
import PlaylistTrack from './PlaylistTrack'
import { playlistStore } from '../hooks/useGlobalPlaylist'

const { queryImages } = window.API_RENDERER

export const Gallery: FC = () => {
  const [searchFilter, setSearchFilter] = useState<string>('')
  const [skeletonsToShow, setSkeletonsToShow] = useState<string[]>([])
  const [imagesArray, setImagesArray] = useState<ImagesArray>([])
  const imagesArrayRef = useRef<ImagesArray>([])
  const modifyInputElement = (elementId: number, currentState: boolean) => {
    const index = imagesArrayRef.current.findIndex(
      (element) => element.id === elementId
    )
    imagesArrayRef.current[index].isChecked = currentState
  }
  const { clearPlaylist, isEmpty } = playlistStore()
  const resetRef = () => {
    imagesArrayRef.current = structuredClone(imagesArray)
  }
  useEffect(() => {
    queryImages().then((data: ImagesArray) => {
      setImagesArray(data)
      imagesArrayRef.current = structuredClone(data)
      setSkeletonsToShow([])
      clearPlaylist()
    })
  }, [])

  const filteredImages = useMemo(() => {
    return imagesArrayRef.current
      .filter((image) =>
        image.imageName
          .toLocaleLowerCase()
          .includes(searchFilter.toLocaleLowerCase())
      )
      .sort((a, b) => {
        return a.id > b.id ? -1 : 1
      })
      .map((image) => {
        return (
          <ImageCard
            key={image.id}
            Image={image}
            modifyInputElement={modifyInputElement}
          ></ImageCard>
        )
      })
  }, [searchFilter, imagesArray, isEmpty])
  const skeletons = useMemo(() => {
    return skeletonsToShow.map((skeletonFileName) => {
      return (
        <Skeleton
          imageName={skeletonFileName}
          key={skeletonFileName}
        ></Skeleton>
      )
    })
  }, [skeletonsToShow])
  if (imagesArrayRef.current.length > 0 || skeletonsToShow.length > 0) {
    return (
      <div className='flex flex-col content-start justify-between m-auto w-[85%] h-[100%] select-none'>
        <div className='flex basis-[85%] flex-col overflow-y-auto my-4'>
          <Filters setSearchFilter={setSearchFilter} />
          <div
            className='overflow-y-scroll scroll-smooth w-full scrollbar-track-rounded-sm
          scrollbar-thumb-rounded-sm scrollbar-thin scrollbar-track-transparent scrollbar-thumb-stone-100  m-auto'
          >
            <div className='m-auto sm:grid sm:auto-cols-auto grid-cols-[repeat(auto-fill,minmax(300px,1fr))]'>
              {skeletons.length > 0 ? skeletons : undefined}
              {filteredImages}
            </div>
          </div>
        </div>
        <PlaylistTrack
          clearPlaylist={clearPlaylist}
          resetRef={resetRef}
          setSkeletonsToShow={setSkeletonsToShow}
          setImagesArray={setImagesArray}
          imagesArrayRef={imagesArrayRef}
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
