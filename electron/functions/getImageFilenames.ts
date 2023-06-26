/* eslint-disable @typescript-eslint/no-var-requires */
import { dialog } from 'electron'
import fs, { type PathLike } from 'fs'
import { copyFile } from 'fs/promises'
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

async function CopyImagesToCacheAndProcessThumbnails(
  imagePaths: string[],
  fileNames: string[]
) {
  const numberOfItems = imagePaths.length
  if (numberOfItems > 0) {
    const destinationFullPath = fileNames.map(
      (fileName) => cacheDirectory.Images + fileName
    )
    for (let currentImage = 0; currentImage < numberOfItems; currentImage++) {
      copyFile(imagePaths[currentImage], destinationFullPath[currentImage])
        .then(() => {
          CreateCacheThumbnail(imagePaths[currentImage])
        })
        .catch((error) => console.error('Could not copy file', error))
    }
  }
}

function returnFilenamesFromCache(path: PathLike) {
  const fileList = fs.readdirSync(path)
  const pathToImage = path
  const fileListWithPath = fileList.map((file) => pathToImage + file)
  return fileListWithPath
}

async function CreateCacheThumbnail(filePath: string) {
  //? I am supposed to be guaranteed that returnFilenamesFromCache always returns something valid, because on each start of the program I am validating if the cache exists, I'll leave it like this for now but could break.
  const fileName = filePath.split('/').at(-1)
  const fileDestination = cacheDirectory.thumbnails + fileName
  if (fileName) {
    if (fileName.endsWith('.gif')) {
      try {
        await sharp(filePath, { animated: true })
          .resize(300, 200, {
            kernel: sharp.kernel.nearest,
            fit: 'cover'
          })
          .gif({ dither: 0 })
          .toFile(fileDestination)
          .then((info: any) => {
            console.log(info)
          })
      } catch (error) {
        console.log(error)
      }
    } else {
      try {
        await sharp(filePath)
          .resize(300, 200, {
            kernel: sharp.kernel.nearest,
            fit: 'cover'
          })
          .toFile(fileDestination)
          .then((info: any) => {
            console.log(info)
          })
      } catch (error) {
        console.log(error)
      }
    }
  }
}

export function addNewImages() {
  const imagePathsFromFilePicker = openImagesFromFilePicker()
  const filteredImagePaths = getValidImages(imagePathsFromFilePicker)
  const fileNames = filteredImagePaths
    .map((image) => image.split('/').at(-1) || '')
    .filter((item) => item !== '')
  //copyImagesToCacheAndProcessThumbnails(filteredImagePaths, fileNames)
  CopyImagesToCacheAndProcessThumbnails(filteredImagePaths, fileNames)
  return fileNames
}

export function getImagesFromCache() {
  const imagesInCache = returnFilenamesFromCache(cacheDirectory.thumbnails)
  const imagesInCacheWithFileProtocol = imagesInCache.map(
    (imagePath) => 'atom://' + imagePath
  )
  return imagesInCacheWithFileProtocol
}
