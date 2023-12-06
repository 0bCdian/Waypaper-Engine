export type fileList = string[] | undefined
export interface imagesObject {
  imagePaths: string[]
  fileNames: string[]
}
export enum ORDER_TYPES {
  ORDERED = 'ordered',
  RANDOM = 'random'
}

export type PlaylistType = {
  images: images
  id: number
  name: string
  type: PLAYLIST_TYPES
  interval: number | null
  order: ORDER_TYPES | null
  showAnimations: boolean | 0 | 1
  currentImageIndex: number
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
  RANDOM_IMAGE = 'random-image',
  STOP_DAEMON = 'stop-daemon',
  PAUSE_PLAYLIST = 'pause-playlist',
  RESUME_PLAYLIST = 'resume-playlist',
  STOP_PLAYLIST = 'stop-playlist',
  UPDATE_CONFIG = 'update-config',
  UPDATE_PLAYLIST = 'update-playlist',
  ERROR = 'error'
}

export interface message {
  action: ACTIONS
  message?: string
}

export type images = { name: string; time: number | null }[]

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
  time: number | null
}

export type Image = {
  id: number
  name: string
  isChecked: boolean | 1 | 0
  width: number
  height: number
  format: string
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

export type Monitor = {
  name: string
  width: number
  height: number
  currentImage: string
  position: number
}
