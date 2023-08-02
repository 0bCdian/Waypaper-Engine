import { create } from 'zustand'
import { ImagesArray, Image } from '../types/rendererTypes'

const imagesInitial: ImagesArray = []
const configurationInitial = {
  playlistType: 'timer',
  hours: 1,
  minutes: 0,
  order: 'ordered',
  showTransition: true
}

const initialPlaylistState = {
  images: imagesInitial,
  configuration: configurationInitial,
  name: ''
}

interface playlist {
  images: ImagesArray
  configuration: configuration
  name: string
}
type configuration = typeof configurationInitial

interface State {
  playlist: playlist
  isEmpty: boolean
}

interface Actions {
  addImageToPlaylist: (Image: Image) => void
  addMultipleImagesToPlaylist: (Images: ImagesArray) => void
  setConfiguration: (newConfiguration: configuration) => void
  setName: (newName: string) => void
  movePlaylistArrayOrder: (newlyOrderedArray: ImagesArray) => void
  removeImageFromPlaylist: (Image: Image) => void
  clearPlaylist: () => void
}

export const playlistStore = create<State & Actions>()((set) => ({
  playlist: initialPlaylistState,
  isEmpty: true,
  addImageToPlaylist: (Image: Image) => {
    set((state) => {
      const newImages = [...state.playlist.images, Image]
      const newState = {
        ...state,
        playlist: { ...state.playlist, images: newImages },
        isEmpty: false
      }
      return newState
    })
  },
  addMultipleImagesToPlaylist: (Images: ImagesArray) => {
    set((state) => {
      const newImages = [...state.playlist.images, ...Images]
      const newState = {
        ...state,
        playlist: { ...state.playlist, images: newImages },
        isEmpty: false
      }
      return newState
    })
  }
  ,
  setConfiguration: (newConfiguration: configuration) => {
    set((state) => {
      return {
        ...state,
        playlist: { ...state.playlist, configuration: newConfiguration }
      }
    })
  },
  setName: (newName: string) => {
    set((state) => {
      return { ...state, playlist: { ...state.playlist, name: newName } }
    })
  },
  movePlaylistArrayOrder: (newlyOrderedArray: ImagesArray) => {
    set((state) => {
      return {
        ...state,
        playlist: { ...state.playlist, images: newlyOrderedArray }
      }
    })
  },
  removeImageFromPlaylist: (Image: Image) => {
    set((state) => {
      const newImages = state.playlist.images.filter(
        (element) => element.id !== Image.id
      )
      return {
        ...state,
        playlist: { ...state.playlist, images: newImages }
      }
    })
  },
  clearPlaylist: () => {
    set((state) => {
      return {
        ...state,
        playlist: initialPlaylistState,
        isEmpty: true
      }
    })
  }
}))
