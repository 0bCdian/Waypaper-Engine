import { create } from 'zustand'
import { ImagesArray, Image } from '../types/rendererTypes'

interface State {
  imagesInPlaylist: ImagesArray
}

const initialState: ImagesArray = []
interface Actions {
  addImageToPlaylist: (Image: Image) => void
  removeImageFromPlaylist: (Image: Image) => void
  clearPlaylist: () => void
  movePlaylistArrayOrder: (newlyOrderedArray: ImagesArray) => void
}

export const playlistStore = create<State & Actions>((set) => ({
  imagesInPlaylist: initialState,
  addImageToPlaylist: (Image: Image) => {
    set((state) => ({
      imagesInPlaylist: [...state.imagesInPlaylist, Image]
    }))
  },
  removeImageFromPlaylist: (Image: Image) => {
    set((state) => ({
      imagesInPlaylist: state.imagesInPlaylist.filter(
        (imageInPlaylist) => imageInPlaylist.id !== Image.id
      )
    }))
  },
  movePlaylistArrayOrder: (newlyOrderedArray: ImagesArray) => {
    set(() => ({
      imagesInPlaylist: newlyOrderedArray
    }))
  },
  clearPlaylist: () => {
    set(() => ({
      imagesInPlaylist: initialState
    }))
  }
}))
