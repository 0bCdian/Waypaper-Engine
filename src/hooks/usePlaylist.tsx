import { useState } from 'react'
import { ImagesArray, Image } from '../types/rendererTypes'

function usePlaylist() {
  const [imagesInPlaylist, setImagesInPlaylist] = useState<ImagesArray>([])
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
  const movePlaylistArrayOrder = (newlyOrderedArray:ImagesArray)=>{
    setImagesInPlaylist(newlyOrderedArray)
  }
  const clearPlaylist = () => {
    setImagesInPlaylist([])
  }
  return {
    imagesInPlaylist,
    addImageToPlaylist,
    removeImageFromPlaylist,
    movePlaylistArrayOrder,
    clearPlaylist
  }
}

export default usePlaylist
