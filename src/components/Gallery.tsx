import { ImageCard } from './ImageCard'
import { type FC, useState, useEffect, useRef, useMemo } from 'react'
import { Skeleton } from './Skeleton'
import { type ImagesArray } from '../types/rendererTypes'
import { AddImagesCard } from './AddImagesCard'
import Filters from './Filters'
import PlaylistTrack from './PlaylistTrack'
import { playlistStore } from '../hooks/useGlobalPlaylist'
import PaginatedGallery from './PaginatedGallery'

const { queryImages } = window.API_RENDERER

export const Gallery: FC = () => {
  const [searchFilter, setSearchFilter] = useState<string>('')
  const [skeletonsToShow, setSkeletonsToShow] = useState<string[]>([])
  const [imagesArray, setImagesArray] = useState<ImagesArray>([])
  const { clearPlaylist, isEmpty } = playlistStore()
  const imagesArrayRef = useRef<ImagesArray>([])
  const modifyInputElement = (
    currentState: boolean,
    elementId?: number,
    elementName?: string
  ) => {
    if (elementId) {
      const index = imagesArrayRef.current.findIndex(
        (element) => element.id === elementId
      )
      imagesArrayRef.current[index].isChecked = currentState
    } else if (elementName) {
      const index = imagesArrayRef.current.findIndex(
        (element) => element.imageName === elementName
      )
      imagesArrayRef.current[index].isChecked = currentState
    } else {
      console.error('No elementId or elementName provided')
    }
  }
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
  useEffect(() => {}, [imagesArray])
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
      <div className='flex flex-col justify-between m-auto w-full sm:w-[85%] h-[100%] select-none'>
        <div className='flex flex-col items-center md:items-start overflow-y-auto mt-5'>
          <Filters setSearchFilter={setSearchFilter} />
          <PaginatedGallery
            imagesArray={filteredImages}
            SkeletonsArray={skeletons}
          />
        </div>

        <PlaylistTrack
          modifyInputElement={modifyInputElement}
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
