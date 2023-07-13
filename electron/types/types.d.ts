export type fileList = string[] | undefined
export interface imagesObject {
  imagePaths: string[]
  fileNames: string[]
}

export interface imageModel {
  id: number
  imageName: string
}
export interface playlist {
  name: string
  imagesList: string[]
  currentImageIndex: number
  interval: number
}
