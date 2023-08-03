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

export type configuration = {
  playlistType: string
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
