import { ORDER_TYPES } from '../../src/types/rendererTypes'
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
  type: string
  hours: number
  minutes: number
  order: ORDER_TYPES
  showTransition: boolean
  currentImageIndex: number
}
