/* eslint-disable @typescript-eslint/no-var-requires */
import { dialog } from 'electron'
import fs, { type PathLike } from 'fs'
import { cacheDirectory } from '../globals/globals'
const sharp = require('sharp')

type fileList = string[] | undefined
const validImageExtensions = [
  'jpeg',
  'png',
  'gif',
  'bmp',
  'webp',
  'pnm',
  'tga',
  'tiff',
  'farbfeld'
]
function openImagesFromFilePicker() {
  const file: fileList = dialog.showOpenDialogSync({
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Images', extensions: validImageExtensions }],
    defaultPath: '/'
  }) ?? ['/']
  console.log(file)
  return file
}
//* TODO: implement a more robust way of detecting filetypes, ie: reading the magic number from binary data.
function getValidImages(imagePaths: string[]) {
  const validImageExtensions = [
    'jpeg',
    'png',
    'gif',
    'bmp',
    'webp',
    'pnm',
    'tga',
    'tiff',
    'farbfeld'
  ]
  return imagePaths.filter((imagePath) => {
    //? if the image has many dots it will not pass, Im assuming the file is blablabla.ext
    const [, imageExtension] = imagePath.split('.')
    return validImageExtensions.includes(imageExtension)
  })
}

async function copyImagesToCacheAndProcessThumbnails(imagePaths: string[]) {
  imagePaths.forEach((imagePath) => {
    const imageName = imagePath.split('/').at(-1)
    if (imageName !== undefined) {
      const destination = cacheDirectory.Images + imageName
      try {
        fs.copyFileSync(imagePath, destination)
      } catch (e) {
        console.error(e)
      }
    }
  })
  await createCacheThumbnails()
}

function returnFilenamesFromCache(path: PathLike) {
  const fileList = fs.readdirSync(path)
  const pathToImage = path
  const fileListWithPath = fileList.map((file) => pathToImage + file)
  return fileListWithPath
}

async function createCacheThumbnails() {
  //? I am supposed to be guaranteed that returnFilenamesFromCache always returns something valid, because on each start of the program I am validating if the cache exists, I'll leave it like this for now but could break.
  const cachedImages = returnFilenamesFromCache(cacheDirectory.Images)
  const filenames = cachedImages.map((imagePath) => imagePath.split('/').at(-1))
  const cachedImagesLength = cachedImages.length
  for (let index = 0; index < cachedImagesLength; index++) {
    const thumbnailImagePath = cacheDirectory.thumbnails + filenames[index]
    try {
      await sharp(cachedImages[index])
        .resize(300, 200, {
          kernel: sharp.kernel.nearest,
          fit: 'cover'
        })
        .toFile(thumbnailImagePath)
        .then((info: any) => {
          console.log(info)
        })
    } catch (error) {
      console.log(error)
    }
  }
}

export function addNewImages() {
  const imagePathsFromFilePicker = openImagesFromFilePicker()
  const filteredImagePaths = getValidImages(imagePathsFromFilePicker)
  const fileNames = filteredImagePaths.map((image) => image.split('/').at(-1))
  copyImagesToCacheAndProcessThumbnails(filteredImagePaths)
  return fileNames || ['']
}

export function getImagesFromCache() {
  const imagesInCache = returnFilenamesFromCache(cacheDirectory.thumbnails)
  const imagesInCacheWithFileProtocol = imagesInCache.map(
    (imagePath) => 'atom://' + imagePath
  )
  return imagesInCacheWithFileProtocol
}
