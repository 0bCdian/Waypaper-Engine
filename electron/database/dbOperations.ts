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

