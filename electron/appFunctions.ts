import { dialog } from 'electron'
import { rmSync, mkdirSync, existsSync, readdirSync, readdir } from 'node:fs'
import { copyFile } from 'node:fs/promises'
import {
  appDirectories,
  validImageExtensions,
  WAYPAPER_ENGINE_SOCKET_PATH
} from './globals/globals'
import { fileList, imagesObject, ACTIONS, message } from './types/types'
import { rendererPlaylist } from '../src/types/rendererTypes'
import { exec, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { daemonLocation } from './binaries'
import { join, basename } from 'node:path'
import { createConnection } from 'node:net'
import dbOperations from './database/dbOperations'
import config from './database/globalConfig'

const execPomisified = promisify(exec)
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
  return dbOperations.storeImagesInDB(imagesToStoreinDB)
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
      console.error('failed to create thumbnail for:', imageName)
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

export async function remakeThumbnailsIfImagesExist() {
  readdir(appDirectories.thumbnails, (err, thumbnails) => {
    if (err) {
      throw new Error('Could not read thumbnails directory')
    }
    if (thumbnails.length < 1) {
      readdir(appDirectories.imagesDir, (err, images) => {
        if (err) {
          throw new Error(`Could not read the images directory: ${err}`)
        } else if (images.length < 1) {
          return
        }
        for (let current = 0; current < images.length; current++) {
          const filePathSource = join(appDirectories.imagesDir, images[current])
          createCacheThumbnail(filePathSource, images[current])
        }
      })
    }
  })
}
export async function checkCacheOrCreateItIfNotExists() {
  if (!existsSync(appDirectories.rootCache)) {
    createFolders(appDirectories.rootCache, appDirectories.thumbnails)
  } else {
    if (!existsSync(appDirectories.thumbnails)) {
      createFolders(appDirectories.thumbnails)
    }
  }
  if (!existsSync(appDirectories.mainDir)) {
    deleteFolders(appDirectories.thumbnails)
    createFolders(
      appDirectories.mainDir,
      appDirectories.imagesDir,
      appDirectories.thumbnails
    )
  } else {
    if (!existsSync(appDirectories.imagesDir)) {
      deleteFolders(appDirectories.thumbnails)
      createFolders(appDirectories.imagesDir, appDirectories.thumbnails)
    }
  }
}

function createFolders(...args: string[]) {
  try {
    args.forEach((path) => {
      mkdirSync(path)
    })
  } catch (error) {
    console.error(error)
  }
}

function deleteFolders(...args: string[]) {
  try {
    args.forEach((path) => {
      rmSync(path, { recursive: true, force: true })
    })
  } catch (error) {
    console.error(error)
  }
}

function checkAndRenameDuplicates(filenamesToCopy: string[]) {
  const currentImagesStored = readdirSync(appDirectories.imagesDir)
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

export async function setImage(
  _event: Electron.IpcMainInvokeEvent,
  imageName: string
) {
  const command = getSwwwCommandFromConfiguration(
    join(appDirectories.imagesDir, `"${imageName}"`)
  )
  console.log(command)

  try {
    await execPomisified(`${command}`)
  } catch (error) {
    console.error(error)
  }
}

export async function isSwwwDaemonRunning() {
  await checkIfSwwwIsInstalled()
  exec(`ps -A | grep "swww-daemon"`, (_error, stdout, _stderr) => {
    if (!(stdout.toLowerCase().indexOf('swww-daemon'.toLowerCase()) > -1)) {
      isSwwwSocketClean()
      execPomisified('swww init')
    } else {
      console.log('Swww Daemon already running')
    }
  })
}

function isSwwwSocketClean() {
  //TODO check if I can get around hardcoding the socket path
  const socketPath = '/run/user/1000/swww.socket'
  if (existsSync(socketPath)) {
    rmSync(socketPath)
  }
}

export async function checkIfSwwwIsInstalled() {
  const { stdout } = await execPomisified(`swww --version`)
  if (stdout) {
    console.info('swww is installed in the system')
  } else {
    console.warn(
      'swww is not installed, please find instructions in the README.md on how to install it'
    )
    throw new Error('swww is not installed')
  }
}
export async function savePlaylist(
  _event: Electron.IpcMainInvokeEvent,
  playlistObject: rendererPlaylist
) {
  try {
    if (dbOperations.checkIfPlaylistExists(playlistObject.name)) {
      dbOperations.updatePlaylistInDB(playlistObject)
    } else {
      dbOperations.storePlaylistInDB(playlistObject)
    }
  } catch (error) {
    console.error(error)
    throw Error('Failed to set playlist in DB')
  }
}
async function isWaypaperDaemonRunning() {
  try {
    const { stdout } = await execPomisified('pidof wpe-daemon')
    console.log('Waypaper Engine daemon already running', stdout)
    return true
  } catch (_err) {
    console.log('Waypaper Engine not running')
    return false
  }
}
export async function initWaypaperDaemon() {
  if (!(await isWaypaperDaemonRunning())) {
    try {
      spawn('node', [`${daemonLocation}/daemon.js`])
    } catch (error) {
      console.error(error)
    }
  }
}

async function playlistConnectionBridge(message: message) {
  const connection = createConnection(WAYPAPER_ENGINE_SOCKET_PATH)
  connection.write(JSON.stringify(message))
}

export const PlaylistController = {
  startPlaylist: async function () {
    const message: message = {
      action: ACTIONS.START_PLAYLIST
    }
    playlistConnectionBridge(message)
  },
  pausePlaylist: () => {
    playlistConnectionBridge({
      action: ACTIONS.PAUSE_PLAYLIST
    })
  },
  resumePlaylist: () => {
    playlistConnectionBridge({
      action: ACTIONS.RESUME_PLAYLIST
    })
  },
  stopPlaylist: () => {
    playlistConnectionBridge({
      action: ACTIONS.STOP_PLAYLIST
    })
  },
  nextImage: () => {
    playlistConnectionBridge({
      action: ACTIONS.NEXT_IMAGE
    })
  },
  previousImage: () => {
    playlistConnectionBridge({
      action: ACTIONS.PREVIOUS_IMAGE
    })
  },
  killDaemon: () => {
    playlistConnectionBridge({
      action: ACTIONS.STOP_DAEMON
    })
  },
  updateConfig: () => {
    playlistConnectionBridge({
      action: ACTIONS.UPDATE_CONFIG
    })
  }
}

export function deleteImageFromStorage(imageName: string) {
  try {
    const [thumbnailName] = imageName.split('.')
    rmSync(join(appDirectories.imagesDir, imageName))
    rmSync(join(appDirectories.thumbnails, `${thumbnailName}.webp`), {
      force: true
    })
    if (imageName.endsWith('.gif')) {
      rmSync(join(appDirectories.thumbnails, `${thumbnailName}.gif`), {
        force: true
      })
    }
  } catch (error) {
    console.error(error)
    throw new Error('Could not delete images from storage')
  }
}

export function deleteImageFromGallery(
  _: Electron.IpcMainInvokeEvent,
  imageID: number,
  imageName: string
) {
  try {
    dbOperations.deleteImageInDB(imageID)
    deleteImageFromStorage(imageName)
    return true
  } catch (error) {
    console.error(error)
    return false
  }
}

function getSwwwCommandFromConfiguration(
  imagePath: string,
  monitors?: string[]
) {
  const swwwConfig = config.swww.config
  let transitionPos = ''
  let inverty = swwwConfig.invertY ? '--invert-y' : ''
  switch (swwwConfig.transitionPositionType) {
    case 'int':
      transitionPos = `${swwwConfig.transitionPositionIntX},${swwwConfig.transitionPositionIntY}`
      break
    case 'float':
      transitionPos = `${swwwConfig.transitionPositionFloatX},${swwwConfig.transitionPositionFloatY}`
      break
    case 'alias':
      transitionPos = swwwConfig.transitionPosition
  }
  if (!monitors) {
    const command = `swww img ${imagePath} --resize="${swwwConfig.resizeType}" --fill-color "${swwwConfig.fillColor}" --filter ${swwwConfig.filterType} --transition-type ${swwwConfig.transitionType} --transition-step ${swwwConfig.transitionStep} --transition-duration ${swwwConfig.transitionDuration} --transition-fps ${swwwConfig.transitionFPS} --transition-angle ${swwwConfig.transitionAngle} --transition-pos ${transitionPos} ${inverty} --transition-bezier ${swwwConfig.transitionBezier} --transition-wave "${swwwConfig.transitionWaveX},${swwwConfig.transitionWaveY}"`
    return command
  }
}
