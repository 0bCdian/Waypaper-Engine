import { create } from 'zustand'
import {
  Image,
  rendererPlaylist,
  configuration,
  PLAYLIST_TYPES,
  ORDER_TYPES
} from '../types/rendererTypes'

const imagesInitial: Image[] = []
const configurationInitial = {
  playlistType: PLAYLIST_TYPES.TIMER,
  interval: 3_600_000,
  order: ORDER_TYPES.ORDERED,
  showAnimations: true
}

const initialPlaylistState = {
  images: imagesInitial,
  configuration: configurationInitial,
  name: ''
}

interface State {
  playlist: rendererPlaylist
  isEmpty: boolean
}

interface Actions {
  addImageToPlaylist: (Image: Image) => void
  addMultipleImagesToPlaylist: (Images: Image[]) => void
  setConfiguration: (newConfiguration: configuration) => void
  setName: (newName: string) => void
  movePlaylistArrayOrder: (newlyOrderedArray: Image[]) => void
  removeImageFromPlaylist: (Image: Image) => void
  clearPlaylist: () => void
  readPlaylist: () => rendererPlaylist
  setPlaylist: (newPlaylist: rendererPlaylist) => void
  setImageBeginAndEndTime: (
    Image: Image,
    beginTime: number,
    endTime: number
  ) => void
}

const playlistStore = create<State & Actions>()((set, get) => ({
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
  addMultipleImagesToPlaylist: (Images: Image[]) => {
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
  movePlaylistArrayOrder: (newlyOrderedArray: Image[]) => {
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
  setPlaylist: (newPlaylist: rendererPlaylist) => {
    set((state) => {
      return {
        ...state,
        playlist: newPlaylist,
        isEmpty: false
      }
    })
  },
  setImageBeginAndEndTime(Image: Image, beginTime: number, endTime: number) {
    Image.beginTime = beginTime
    Image.endTime = endTime
  }
}))

export default playlistStore
