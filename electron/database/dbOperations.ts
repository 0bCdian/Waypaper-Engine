import { imageModel } from '../types/types'
import Image from './models'
export async function storeImagesInDB(images: string[]) {
  const imagesToStore = images.map((image) => {
    const imageInstance = {
      imageName: image,
      isChecked: false
    }
    return imageInstance
  })
  await Image.bulkCreate(imagesToStore)
  const queriedImages = await Image.findAll({
    where: {
      imageName: images
    }
  })
  const imagesAdded: imageModel[] = queriedImages.map((image) => {
    const imageData = image.dataValues
    return imageData
  })
  return imagesAdded
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
