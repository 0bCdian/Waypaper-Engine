interface Image {
  id: number
  imageName: string
  tags: string[]
}

export type ImagesArray = Image[]

export interface imagesObject {
  imagePaths: string[]
  fileNames: string[]
}
