export interface Image {
  id: number
  imageName: string
  isChecked: boolean
}

export type ImagesArray = Image[]

export interface imagesObject {
  imagePaths: string[]
  fileNames: string[]
}

export enum ORDER_TYPES {
  ORDERED = 'ordered',
  RANDOM = 'random'
}

export enum PLAYLIST_TYPES {
  TIMER= 'timer',
  NEVER= 'never',
  TIME_OF_DAY= 'timeofday',
  DAY_OF_WEEK= 'dayofweek'
}

export type configuration = {
  playlistType: PLAYLIST_TYPES
  hours: number
  minutes: number
  order: ORDER_TYPES
  showTransition: boolean
}

export type playlist = {
  images: ImagesArray
  configuration: configuration
  name: string
}
