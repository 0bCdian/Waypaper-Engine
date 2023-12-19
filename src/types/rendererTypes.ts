export interface Image {
  id: number
  name: string
  isChecked: boolean
  width: number
  height: number
  format: Formats
  time: number
}

export interface imagesObject {
  imagePaths: string[]
  fileNames: string[]
}

export enum ORDER_TYPES {
  ORDERED = 'ordered',
  RANDOM = 'random'
}

export enum STORE_ACTIONS {
  SET_IMAGES_ARRAY = 'SET_IMAGES_ARRAY',
  SET_SKELETONS_TO_SHOW = 'SET_SKELETONS_TO_SHOW',
  SET_FILTERS = 'SET_FILTERS',
  RESET_IMAGES_ARRAY = 'RESET_IMAGES_ARRAY'
}

export enum PLAYLIST_TYPES {
  TIMER = 'timer',
  NEVER = 'never',
  TIME_OF_DAY = 'timeofday',
  DAY_OF_WEEK = 'dayofweek'
}

export type configuration = {
  playlistType: PLAYLIST_TYPES
  interval: number | null
  order: ORDER_TYPES | null
  showAnimations: boolean | 1 | 0
}

export type rendererPlaylist = {
  images: Image[]
  configuration: configuration
  name: string
}

export type Filters = {
  order: 'asc' | 'desc'
  type: 'name' | 'id'
  searchString: string
  advancedFilters: advancedFilters
}

export type advancedFilters = {
  formats: Formats[]
  resolution: {
    constraint: resolutionConstraints
    width: number
    height: number
  }
}

export type Formats =
  | 'jpg'
  | 'jpeg'
  | 'png'
  | 'bmp'
  | 'gif'
  | 'webp'
  | 'farbeld'
  | 'pnm'
  | 'tga'
  | 'tiff'

export type resolutionConstraints = 'all' | 'exact' | 'moreThan' | 'lessThan'
export type state = {
  imagesArray: Image[]
  skeletonsToShow: string[]
  filters: Filters
}

export type action =
  | { type: STORE_ACTIONS.SET_IMAGES_ARRAY; payload: Image[] }
  | { type: STORE_ACTIONS.SET_SKELETONS_TO_SHOW; payload: string[] }
  | { type: STORE_ACTIONS.SET_FILTERS; payload: Filters }
  | { type: STORE_ACTIONS.RESET_IMAGES_ARRAY; payload: Image[] }

export type openFileAction = 'file' | 'folder'
