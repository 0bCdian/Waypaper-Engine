export type fileList = string[] | undefined
export interface imagesObject {
  imagePaths: string[]
  fileNames: string[]
}
export enum ORDER_TYPES {
  ORDERED = 'ordered',
  RANDOM = 'random'
}

export enum PLAYLIST_TYPES {
  TIMER = 'timer',
  NEVER = 'never',
  TIME_OF_DAY = 'timeofday',
  DAY_OF_WEEK = 'dayofweek'
}

export interface imageModel {
  id: number
  imageName: string
}

export type PlaylistTypeDB = {
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
  PAUSE_PLAYLIST = 'pause-playlist',
  RESUME_PLAYLIST = 'resume-playlist',
  STOP_PLAYLIST = 'stop-playlist'
}

export interface message {
  action: ACTIONS
  payload?: {
    playlistName: string
    swwwOptions: string[]
  }
}

export type PlaylistControllerType = {
  startPlaylist: (
    playlistName: string,
    swwwUserOverrides?: string[] | undefined
  ) => void
  isPlaying: boolean
  pausePlaylist: () => void
  resumePlaylist: () => void
  stopPlaylist: () => void
  nextImage: () => void
  previousImage: () => void
  killDaemon: () => void
}
