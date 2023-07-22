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
