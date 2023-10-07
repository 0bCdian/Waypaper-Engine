import { useEffect } from 'react'
import { useImages } from '../hooks/imagesStore'
import AddImagesCard from './AddImagesCard'
import PaginatedGallery from './PaginatedGallery'
import playlistStore from '../hooks/playlistStore'
import { Image } from '../types/rendererTypes'
import Filters from './Filters'
const { readActivePlaylist, readAppConfig } = window.API_RENDERER

function Gallery() {
  const { isEmpty, imagesArray } = useImages()
  const { setPlaylist } = playlistStore()
  function setLastActivePlaylist() {
    readActivePlaylist().then((playlist) => {
      if (playlist === undefined) {
        return
      }
      const imagesToStorePlaylist: Image[] = []
      playlist.images.forEach((imageNameFromDB) => {
        const imageToCheck = imagesArray.find((imageInGallery) => {
          return imageInGallery.name === imageNameFromDB
        }) as Image
        imageToCheck.isChecked = true
        imagesToStorePlaylist.push(imageToCheck)
      })
      const currentPlaylist = {
        name: playlist.name,
        configuration: {
          playlistType: playlist.type,
          order: playlist.order,
          interval: playlist.interval,
          showAnimations: playlist.showAnimations === 1 ? true : false
        },
        images: imagesToStorePlaylist
      }
      setPlaylist(currentPlaylist)
    })
  }
  useEffect(() => {
    readAppConfig().then((appSettings) => {
      if (appSettings.introAnimation && !appSettings.startMinimized) {
        setTimeout(() => {
          setLastActivePlaylist()
        }, 3700)
      } else {
        setLastActivePlaylist()
      }
    })
  }, [isEmpty])
  return (
    <>
      {!isEmpty ? (
        <>
          <Filters />
          <PaginatedGallery />
        </>
      ) : (
        <div className='flex justify-center items-center h-screen m-auto'>
          <div>
            <AddImagesCard />
          </div>
        </div>
      )}
    </>
  )
}

export default Gallery
