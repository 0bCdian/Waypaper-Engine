import { create } from 'zustand'
import {
  ImagesArray,
  Image,
  playlist,
  configuration,
  PLAYLIST_TYPES,
  ORDER_TYPES
} from '../types/rendererTypes'

const imagesInitial: ImagesArray = []
const configurationInitial = {
  playlistType: PLAYLIST_TYPES.TIMER,
  hours: 1,
  minutes: 0,
  order: ORDER_TYPES.ORDERED,
  showTransition: true
}

const initialPlaylistState = {
  images: imagesInitial,
  configuration: configurationInitial,
  name: ''
}

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
  readPlaylist: () => playlist
  setPlaylist: (newPlaylist: playlist) => void
}

export const playlistStore = create<State & Actions>()((set, get) => ({
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
  },
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
  },
  readPlaylist: () => {
    return get().playlist
  },
  setPlaylist:(newPlaylist:playlist)=>{
    set((state) => {
      return {
        ...state,
        playlist: newPlaylist,
        isEmpty: false
      }
    })
  }
}))
