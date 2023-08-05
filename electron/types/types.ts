import { ORDER_TYPES, PLAYLIST_TYPES } from '../../src/types/rendererTypes'
export type fileList = string[] | undefined
export interface imagesObject {
  imagePaths: string[]
  fileNames: string[]
}

export interface imageModel {
  id: number
  imageName: string
}

export enum SWWW_VERSION {
  SYSTEM_INSTALLED = 'system-installed',
  NOT_INSTALLED = 'not-installed'
}

export type PlaylistType = {
  id: number
  name: string
  images: string
  type: PLAYLIST_TYPES
  hours: number
  minutes: number
  order: ORDER_TYPES
  showTransition: boolean
  currentImageIndex: number
}

export enum ACTIONS {
  NEXT_IMAGE = 'next-image',
  PREVIOUS_IMAGE = 'previous-image',
  START_PLAYLIST = 'start-playlist',
  STOP_DAEMON = 'stop-daemon',
  PAUSE_PLAYLIST = 'pause-playlist'
}

export interface message {
  action: ACTIONS
  payload?: {
    playlistName: string
    swwwOptions: string[]
    SWWW_VERSION: SWWW_VERSION
    swwwBin: string
  }
}
