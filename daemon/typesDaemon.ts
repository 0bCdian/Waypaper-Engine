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

export type PlaylistDB = {
  id: number
  name: string
  type: PLAYLIST_TYPES
  interval: number | null
  order: ORDER_TYPES | null
  showTransition: boolean | 1 | 0
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

export type PlaylistParsed = {
  id: number
  name: string
  images: string[]
  type: PLAYLIST_TYPES
  interval: number
  order: ORDER_TYPES
  showTransition: boolean
  currentImageIndex: number
}
export interface PlaylistInterface {
  images: string[]
  currentName: string
  currentType: PLAYLIST_TYPES
  intervalID: NodeJS.Timeout | null
  currentImageIndex: number
  interval: number | null
  swwwOptions: string[]
  pause: () => void
  resume: () => void
  stop: () => void
  resetInterval: () => void
  nextImage: () => void
  previousImage: () => void
  start: (playlistName: string, swwwOptions: string[]) => Promise<void>
  sleep: (ms: number) => Promise<void>
  updateInDB: (imageIndex: number, playlistName: string) => Promise<void>
  setPlaylist: (playlistName: string, swwwOptions: string[]) => Promise<void>
  timedPlaylist: () => Promise<void>
  neverPlaylist: () => Promise<void>
  timeOfDayPlaylist: () => Promise<void>
  dayOfWeekPlaylist: () => Promise<void>
}

export enum PlaylistStates {
  PLAYING = 'playing',
  PAUSED = 'paused',
  STOPPED = 'stopped'
}
export enum dbTables {
  Images = 'Images',
  Playlists = 'Playlists',
  imagesInPlaylist = 'imagesInPlaylist'
}

export type imageInPlaylist = {
  imageID: number
  playlistID: number
  indexInPlaylist: number
  beginTime: number | null
  endTime: number | null
}
