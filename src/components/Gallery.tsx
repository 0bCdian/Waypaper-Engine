import { useEffect } from 'react'
import { useImages } from '../hooks/imagesStore'
import AddImagesCard from './AddImagesCard'
import PaginatedGallery from './PaginatedGallery'
import playlistStore from '../hooks/playlistStore'
import { Image, PLAYLIST_TYPES } from '../types/rendererTypes'
import Filters from './Filters'
const { readActivePlaylist, readAppConfig, onDeleteImageFromGallery } =
  window.API_RENDERER

function Gallery() {
  const { isEmpty, imagesArray, removeImageFromStore } = useImages()
  const { setPlaylist, removeImageFromPlaylist } = playlistStore()
  function setLastActivePlaylist() {
    readActivePlaylist().then((playlist) => {
      if (playlist === undefined) {
        return
      }
      const imagesToStorePlaylist: Image[] = []
      playlist.images.forEach((imageInActivePlaylist) => {
        const imageToCheck = imagesArray.find((imageInGallery) => {
          return imageInGallery.name === imageInActivePlaylist.name
        }) as Image
        if (
          playlist.type === PLAYLIST_TYPES.TIME_OF_DAY &&
          imageInActivePlaylist.time !== null
        ) {
          imageToCheck.time = imageInActivePlaylist.time
        }
        imageToCheck.isChecked = true
        imagesToStorePlaylist.push(imageToCheck)
      })
      const currentPlaylist = {
        name: playlist.name,
        configuration: {
          playlistType: playlist.type,
          order: playlist.order,
          interval: playlist.interval,
          showAnimations: playlist.showAnimations === 1 ? true : false,
        },
        images: imagesToStorePlaylist,
      }
      setPlaylist(currentPlaylist)
    })
  }
  onDeleteImageFromGallery((_event, image) => {
    removeImageFromStore(image.id)
    removeImageFromPlaylist(image)
  })
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
  if (isEmpty) {
    return (
      <div className="flex justify-center items-center h-screen m-auto">
        <div>
          <AddImagesCard />
        </div>
      </div>
    )
  } else {
    return (
      <>
        <Filters />
        <PaginatedGallery />
      </>
    )
  }
}

export default Gallery
