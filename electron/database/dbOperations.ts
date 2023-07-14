import { imageModel } from '../types/types'
import Image from './models'
export async function storeImagesInDB(images: string[]) {
  const imagesToStore = images.map((image) => {
    const [newName, extension] = image.split('.')
    const imageInstance = {
      imageName: extension === 'gif' ? image : newName + '.webp'
    }
    return imageInstance
  })
  await Image.bulkCreate(imagesToStore)
}

export async function readImagesFromDB() {
  try {
    const imageInstancesArray = await Image.findAll()
    const imagesArray: imageModel[] = imageInstancesArray.map((image) => {
      const imageData = image.dataValues
      return imageData
    })
    return imagesArray
  } catch (error) {
    console.error(error)
  }
}
