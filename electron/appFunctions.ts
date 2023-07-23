/* eslint-disable @typescript-eslint/no-var-requires */
import { dialog } from 'electron'
import fs, { rmSync } from 'node:fs'
import { copyFile } from 'node:fs/promises'
import {
  appDirectories,
  swwwDefaults,
  validImageExtensions
} from './globals/globals'
import Image from './database/models'
import { fileList, imagesObject } from './types/types'
import { storeImagesInDB } from './database/dbOperations'
import { exec, execFile } from 'node:child_process'
import { execPath } from './binaries'
import { join, basename } from 'node:path'

function openImagesFromFilePicker() {
  const file: fileList = dialog.showOpenDialogSync({
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Images', extensions: validImageExtensions }],
    defaultPath: appDirectories.systemHome
  })
  return file
}

export async function copyImagesToCacheAndProcessThumbnails(
  _event: Electron.IpcMainInvokeEvent,
  { imagePaths, fileNames }: imagesObject
) {
  const uniqueFileNames = checkAndRenameDuplicates(fileNames)
  const imagesToStore = uniqueFileNames.map((imageName, currentImage) => {
    return new Promise<string>(async (resolve) => {
      await copyFile(
        imagePaths[currentImage],
        join(appDirectories.imagesDir, imageName)
      ).then(async () => {
        await createCacheThumbnail(imagePaths[currentImage], imageName)
        resolve(imageName)
      })
    })
  })
  const resolvedObjectsArray = await Promise.allSettled(imagesToStore)
  const imagesToStoreinDB: string[] = []
  resolvedObjectsArray.forEach((imagePromise) => {
    if (imagePromise.status === 'fulfilled') {
      imagesToStoreinDB.push(imagePromise.value)
    }
  })
  return await storeImagesInDB(imagesToStoreinDB)
}

async function createCacheThumbnail(filePathSource: string, imageName: string) {
  const sharp = require('sharp')
  const [name] = imageName.split('.')
  const fileDestinationPath = join(appDirectories.thumbnails, name + '.webp')
  if (imageName) {
    try {
      await sharp(filePathSource, { animated: true, limitInputPixels: false })
        .resize(300, 200, {
          fit: 'cover'
        })
        .webp({ quality: 60, force: true, effort: 6 })
        .toFile(fileDestinationPath)
        .then((info: any) => {
          console.log(info)
        })
    } catch (error) {
      console.error(error)
      console.log('failed to create thumbnail for:', imageName)
    }
  }
}

export function openAndReturnImagesObject() {
  const imagePathsFromFilePicker = openImagesFromFilePicker()
  if (!imagePathsFromFilePicker) {
    return
  }
  const fileNames = imagePathsFromFilePicker.map((image) => basename(image))
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
      appDirectories.thumbnails,
      appDirectories.playlistsDir
    )
  } else {
    if (!fs.existsSync(appDirectories.imagesDir)) {
      deleteFolders(appDirectories.thumbnails, appDirectories.playlistsDir)
      //
      await Image.sync({ force: true })
      createFolders(
        appDirectories.imagesDir,
        appDirectories.thumbnails,
        appDirectories.playlistsDir
      )
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
  const filesToCopyWithoutConflicts: string[] = []
  const filesToCopyLength = filesToCopy.length
  for (let i = 0; i < filesToCopyLength; i++) {
    const file = filesToCopy[i]
    const extensionIndex = file.lastIndexOf('.')
    const fileNameWithoutExtension =
      extensionIndex !== -1 ? file.substring(0, extensionIndex) : file
    const fileExtension =
      extensionIndex !== -1 ? file.substring(extensionIndex) : ''

    let uniqueFileName = fileNameWithoutExtension
    let count = 1
    while (existingFiles.includes(uniqueFileName + fileExtension)) {
      uniqueFileName = `${fileNameWithoutExtension}(${count})`
      count++
    }
    filesToCopyWithoutConflicts.push(uniqueFileName + fileExtension)
  }
  return filesToCopyWithoutConflicts
}

export function setImage(
  _event: Electron.IpcMainInvokeEvent,
  imageName: string
) {
  exec(`pgrep '^swww$'`, (_error, stdout, _stderr) => {
    if (!parseInt(stdout)) {
      const options = [...swwwDefaults]
      options.push(join(appDirectories.imagesDir, imageName))
      execFile(join(execPath, 'swww'), options, (error, stdout, stderr) => {
        if (error) {
          console.log(error, stderr, stdout)
        }
      })
    } else {
      setTimeout(() => {
        setImage(_event, imageName)
      }, 3000)
    }
  })
}

export function isDaemonRunning() {
  exec(`ps -A | grep "swww-daemon"`, (_error, stdout, _stderr) => {
    if (!(stdout.toLowerCase().indexOf('swww-daemon'.toLowerCase()) > -1)) {
      isSocketClean()
      execFile(
        join(execPath, 'swww-daemon'),
        ['&', 'disown'],
        (error, stdout, stderr) => {
          console.log(error, stdout, stderr)
        }
      )
    } else {
      console.log('Daemon already running')
    }
  })
}

function isSocketClean() {
  //TODO check if I can get around hardcoding the socket path
  const socketPath = '/run/user/1000/swww.socket'
  if (fs.existsSync(socketPath)) {
    rmSync(socketPath)
  }
}

/* function initPlaylist(
  playlistObject: playlist,
  swwwConfig = swwwDefaults,
  swwwBin: string,
  childPathFile: string
) {
  const messageForChild = {
    playlistObject,
    swwwBin,
    swwwConfig,
    appDirectories
  }
  const child = fork(childPathFile)
  child.send(messageForChild)
  return child
} */

export function setBinInPath() {
  exec(`export PATH=${execPath}`, (error, _stdout, _stderr) => {
    if (error) {
      console.error(error)
    } else {
      console.log('PATH set')
    }
  })
}

function checkIfSwwwIsInstalled() {
  exec(`swww --version`, (error, _stdout, _stderr) => {
    if (error) {
      console.error(error)
      console.log(error)
      return false
    } else {
      console.log('swww is installed')
      return true
    }
  })
}
checkIfSwwwIsInstalled()
