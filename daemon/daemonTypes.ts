export enum SWWW_VERSION {
  SYSTEM_INSTALLED = 'system-installed',
  NOT_INSTALLED = 'not-installed'
}

enum ORDER_TYPES {
  ORDERED = 'ordered',
  RANDOM = 'random'
}

export type appDirectories = {
  systemHome: string
  rootCache: string
  thumbnails: string
  mainDir: string
  imagesDir: string
  playlistsDir: string
}

export type PlaylistType = {
  id:number
  name: string
  images: string
  type: string
  hours: number
  minutes: number
  order: ORDER_TYPES
  showTransition: boolean
  currentImageIndex: number
}



export interface message {
  action: ACTIONS
  payload: {
    playlistName: string
    swwwOptions: string[]
    SWWW_VERSION: SWWW_VERSION
    swwwBin: string
  }
}

export enum ACTIONS {
  NEXT_IMAGE = 'next-image',
  PREVIOUS_IMAGE = 'previous-image',
  START_PLAYLIST = 'start-playlist',
  STOP_DAEMON = 'stop-daemon',
  PAUSE_PLAYLIST = 'pause-playlist'
}
