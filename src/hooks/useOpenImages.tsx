import { create } from 'zustand'
import {
  Image,
  PLAYLIST_TYPES,
  imagesObject,
  rendererPlaylist
} from '../types/rendererTypes'
const { openFiles, handleOpenImages } = window.API_RENDERER
interface State {
  isActive: boolean
}
interface openImagesProps {
  setSkeletons: (skeletons: string[]) => void
  setImagesArray: (imagesArray: Image[]) => void
  addMultipleImagesToPlaylist: (Images: Image[]) => void
  addImageToPlaylist: (Image: Image) => void
  currentPlaylist: rendererPlaylist
}

interface Actions {
  openImages: ({}: openImagesProps) => Promise<void>
}

const openImagesStore = create<State & Actions>((set) => ({
  isActive: false,
  openImages: async ({
    setSkeletons,
    setImagesArray,
    addMultipleImagesToPlaylist,
    addImageToPlaylist,
    currentPlaylist
  }) => {
    set(() => ({ isActive: true }))
    const imagesObject: imagesObject = await openFiles()
    set(() => ({ isActive: false }))
    if (!imagesObject) return
    imagesObject.fileNames.reverse()
    imagesObject.imagePaths.reverse()
    setSkeletons(imagesObject.fileNames)
    const imagesArray: Image[] = await handleOpenImages(imagesObject)
    const newImagesAdded = imagesArray.map((image) => {
      let playlistImagesLength = currentPlaylist.images.length
      let shouldCheckImage
      switch (currentPlaylist.configuration.playlistType) {
        case PLAYLIST_TYPES.NEVER:
          shouldCheckImage = true
          break
        case PLAYLIST_TYPES.TIMER:
          shouldCheckImage = true
          break
        case PLAYLIST_TYPES.TIME_OF_DAY:
          //todo limit somehow when I implement this type of playlist
          shouldCheckImage = true
          break
        case PLAYLIST_TYPES.DAY_OF_WEEK:
          if (playlistImagesLength < 7) {
            shouldCheckImage = true
            addImageToPlaylist({
              ...image,
              isChecked: shouldCheckImage
            })
          } else {
            shouldCheckImage = false
          }
          playlistImagesLength++
      }
      return {
        ...image,
        isChecked: shouldCheckImage
      }
    })
    setSkeletons([])
    setImagesArray(newImagesAdded)
    if (
      currentPlaylist.configuration.playlistType === PLAYLIST_TYPES.DAY_OF_WEEK
    ) {
      return
    }
    addMultipleImagesToPlaylist(newImagesAdded)
  }
}))

export default openImagesStore
