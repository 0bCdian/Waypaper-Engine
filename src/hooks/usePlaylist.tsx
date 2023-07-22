import { useState, useEffect } from 'react'
import { ImagesArray, Image } from '../types/rendererTypes'

function usePlaylist() {
  const [imagesInPlaylist, setImagesInPlaylist] = useState<ImagesArray>([])
  const [shouldClear, setShouldClear] = useState<boolean>(false)
  const addImageToPlaylist = (Image: Image) => {
    setImagesInPlaylist((imagesInPlaylist) => [...imagesInPlaylist, Image])
  }
  const removeImageFromPlaylist = (Image: Image) => {
    setImagesInPlaylist((imagesInPlaylist) =>
      imagesInPlaylist.filter(
        (imageInPlaylist) => imageInPlaylist.id !== Image.id
      )
    )
  }
  const movePlaylistArrayOrder = (newlyOrderedArray: ImagesArray) => {
    setImagesInPlaylist(newlyOrderedArray)
  }
  const clearPlaylist = () => {
    setImagesInPlaylist([])
    setShouldClear(true)
  }
  useEffect(() => {
    if (imagesInPlaylist.length > 0) {
      setShouldClear(false)
    }
  }, [imagesInPlaylist])
  return {
    imagesInPlaylist,
    shouldClear,
    addImageToPlaylist,
    removeImageFromPlaylist,
    movePlaylistArrayOrder,
    clearPlaylist
  }
}

export default usePlaylist
