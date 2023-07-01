interface Image {
  id: number
  name: string
  tags?: string[]
}

export type ImagesArray = Image[]

export interface imagesObject {
  imagePaths: string[]
  fileNames: string[]
}
