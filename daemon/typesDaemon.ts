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
  showAnimations: boolean | 1 | 0
  currentImageIndex: number
}

export enum ACTIONS {
  NEXT_IMAGE = 'next-image',
  PREVIOUS_IMAGE = 'previous-image',
  START_PLAYLIST = 'start-playlist',
  STOP_DAEMON = 'stop-daemon',
  PAUSE_PLAYLIST = 'pause-playlist',
  RESUME_PLAYLIST = 'resume-playlist',
  STOP_PLAYLIST = 'stop-playlist',
  UPDATE_CONFIG = 'update-config'
}

export interface message {
  action: ACTIONS
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
  updateConfig: () => void
}

export type PlaylistParsed = {
  id: number
  name: string
  images: string[]
  type: PLAYLIST_TYPES
  interval: number
  order: ORDER_TYPES
  showAnimations: boolean
  currentImageIndex: number
}
export interface PlaylistInterface {
  images: string[]
  currentName: string
  currentType: PLAYLIST_TYPES | undefined
  intervalID: NodeJS.Timeout | undefined
  timeoutID: NodeJS.Timeout | undefined
  currentImageIndex: number
  interval: number | null
  showAnimations: boolean | 1 | 0
  pause: () => void
  resume: () => void
  stop: () => void
  resetInterval: () => void
  nextImage: () => void
  previousImage: () => void
  start: () => Promise<void>
  sleep: (ms: number) => Promise<void>
  updateInDB: (imageIndex: number, playlistName: string) => Promise<void>
  setPlaylist: () => Promise<boolean>
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
  imagesInPlaylist = 'imagesInPlaylist',
  swwwConfig = 'swwwConfig',
  appConfig = 'appConfig',
  activePlaylist = 'activePlaylist'
}

export type imageInPlaylist = {
  imageID: number
  playlistID: number
  indexInPlaylist: number
  beginTime: number | null
  endTime: number | null
}

export type initialAppConfig = {
  killDaemon: number
  playlistStartOnFirstImage: number
  notifications: number
  swwwAnimations: number
  introAnimation: number
  startMinimized: number
}
export enum ResizeType {
  crop = 'crop',
  fit = 'fit',
  none = 'no'
}
export enum FilterType {
  Lanczos3 = 'Lanczos3',
  Bilinear = 'Bilinear',
  CatmullRom = 'CatmullRom',
  Mitchell = 'Mitchell',
  Nearest = 'Nearest'
}
export enum TransitionType {
  none = 'none',
  simple = 'simple',
  fade = 'fade',
  left = 'left',
  right = 'right',
  top = 'top',
  bottom = 'bottom',
  wipe = 'wipe',
  wave = 'wave',
  grow = 'grow',
  center = 'center',
  any = 'any',
  outer = 'outer',
  random = 'random'
}

export enum transitionPosition {
  center = 'center',
  top = 'top',
  left = 'left',
  right = 'right',
  bottom = 'bottom',
  topLeft = 'top-left',
  topRight = 'top-right',
  bottomLeft = 'bottom-left',
  bottomRight = 'bottom-right'
}

const initialSwwwConfigDB = {
  resizeType: ResizeType.crop,
  fillColor: '#000000',
  filterType: FilterType.Lanczos3,
  transitionType: TransitionType.simple,
  transitionStep: 90,
  transitionDuration: 3,
  transitionFPS: 60,
  transitionAngle: 45,
  transitionPositionType: 'alias',
  transitionPosition: transitionPosition.center,
  transitionPositionIntX: 960,
  transitionPositionIntY: 540,
  transitionPositionFloatX: 0.5,
  transitionPositionFloatY: 0.5,
  invertY: 0, // Same as false
  transitionBezier: '.25,.1,.25,1',
  transitionWaveX: 20,
  transitionWaveY: 20
}
export type swwwConfig = typeof initialSwwwConfigDB
