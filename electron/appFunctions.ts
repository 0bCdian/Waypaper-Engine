/* eslint-disable @typescript-eslint/no-var-requires */
import { dialog } from 'electron'
import fs from 'fs'
import { copyFile } from 'fs/promises'
import { appDirectories } from './globals/globals'
const sharp = require('sharp')
import Image from './database/models'
import { fileList, imagesObject } from './types/types'
import { storeImagesInDB } from './database/dbOperations'
// for some reason imports are nuts and so I have to declare this array here otherwise everything breaks
//TODO debug why the hell I need to have the array here and not import it from somewhere else.
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

export async function copyImagesToCacheAndProcessThumbnails(
  _event: Electron.IpcMainInvokeEvent,
  { imagePaths, fileNames }: imagesObject
) {
  const numberOfItems = imagePaths.length
  const storeInDB = []
  const uniqueFileNames = checkAndRenameDuplicates(fileNames)
  const destinationFullPath = uniqueFileNames.map(
    (fileName) => appDirectories.imagesDir + fileName
  )
  for (let currentImage = 0; currentImage < numberOfItems; currentImage++) {
    const currentOperation: Promise<string> = new Promise(async (resolve) => {
      await copyFile(
        imagePaths[currentImage],
        destinationFullPath[currentImage]
      ).then(async () => {
        await createCacheThumbnail(
          imagePaths[currentImage],
          uniqueFileNames[currentImage]
        )
        resolve(uniqueFileNames[currentImage])
      })
    })
    storeInDB.push(currentOperation)
  }
  const resolvedObjectsArray = await Promise.allSettled(storeInDB)
  const resolvedPromises = resolvedObjectsArray.map((resolvedObject) => {
    if (resolvedObject.status === 'fulfilled') {
      return resolvedObject.value
    } else {
      return ''
    }
  })
  const filteredResolvedPromises = resolvedPromises.filter((value) => {
    return value !== ''
  })
  await storeImagesInDB(filteredResolvedPromises)
}

async function createCacheThumbnail(
  filePathSource: string,
  destinationFilename: string
) {
  const [name] = destinationFilename.split('.')
  const fileDestination = appDirectories.thumbnails + name + '.webp'
  if (destinationFilename) {
    try {
      await sharp(filePathSource, { animated: true })
        .resize(300, 200, {
          kernel: sharp.kernel.nearest,
          fit: 'cover'
        })
        .webp({ quality: 80, force: true })
        .toFile(fileDestination)
        .then((info: any) => {
          console.log(info)
        })
    } catch (error) {
      console.log(error)
    }
  }
}

/**
 *
 * [Description]
 * Opens images from filepicker dialog, validates if they're the correct type and return their filenames
 * @returns object with two properties of type string[] containing the names and filepaths of the valid images
 */
export function openAndValidateImages() {
  //Todo actually validate lmao
  const imagePathsFromFilePicker = openImagesFromFilePicker()
  const fileNames = imagePathsFromFilePicker
    .map((image) => image.split('/').at(-1) || '')
    .filter((item) => item !== '')
  return { imagePaths: imagePathsFromFilePicker, fileNames }
}

export async function checkCacheOrCreateItIfNotExists() {
  if (!fs.existsSync(appDirectories.rootCache)) {
    createFolders(appDirectories.rootCache, appDirectories.thumbnails)
  } else {
    if (!fs.existsSync(appDirectories.thumbnails)) {
      createFolders(appDirectories.thumbnails)
    }
  }
  if (!fs.existsSync(appDirectories.mainDir)) {
    // if images dont exist, remove old cache thumbnail
    deleteFolders(appDirectories.thumbnails)
    createFolders(
      appDirectories.mainDir,
      appDirectories.imagesDir,
      appDirectories.thumbnails
    )
  } else {
    if (!fs.existsSync(appDirectories.imagesDir)) {
      deleteFolders(appDirectories.thumbnails)
      //
      await Image.sync({ force: true })
      createFolders(appDirectories.imagesDir, appDirectories.thumbnails)
    }
  }
}

function createFolders(...args: string[]) {
  try {
    args.forEach((path) => {
      fs.mkdirSync(path)
    })
  } catch (error) {
    console.error(error)
  }
}

function deleteFolders(...args: string[]) {
  try {
    args.forEach((path) => {
      fs.rmSync(path, { recursive: true, force: true })
    })
  } catch (error) {
    console.error(error)
  }
}

function checkAndRenameDuplicates(filenamesToCopy: string[]) {
  const currentImagesStored = fs.readdirSync(appDirectories.imagesDir)
  const correctFilenamesToCopy = getUniqueFileNames(
    currentImagesStored,
    filenamesToCopy
  )
  return correctFilenamesToCopy
}

function getUniqueFileNames(existingFiles: string[], filesToCopy: string[]) {
  const filesToCopyWithoutConflicts = []
  const filesToCopyLength = filesToCopy.length
  for (let i = 0; i < filesToCopyLength; i++) {
    const file = filesToCopy[i]
    let uniqueFileName = file
    let count = 1
    while (existingFiles.includes(uniqueFileName)) {
      const extensionIndex = file.lastIndexOf('.')
      if (extensionIndex !== -1) {
        uniqueFileName = `${file.substring(
          0,
          extensionIndex
        )}(${count})${file.substring(extensionIndex)}`
      } else {
        uniqueFileName = `${file}(${count})`
      }
      count++
    }
    filesToCopyWithoutConflicts.push(uniqueFileName)
  }
  return filesToCopyWithoutConflicts
}
