import { imageModel } from '../types/types'
import Image from './models'
export async function storeImagesInDB(images: string[]) {
  const imagesToStore = images.map((image) => {
    const imageInstance = {
      imageName: image,
      tags: '[]'
    }
    return imageInstance
  })
  await Image.bulkCreate(imagesToStore)
}

export async function readImagesFromDB() {
  const imageInstancesArray = await Image.findAll()
  const imagesArray: imageModel[] = imageInstancesArray.map((image) => {
    const imageData = image.dataValues
    imageData.tags = JSON.parse(imageData.tags)
    return imageData
  })
  console.log(imagesArray)
  return imagesArray
}
