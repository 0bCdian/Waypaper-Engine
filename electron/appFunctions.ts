import { dialog } from 'electron'
import { rmSync, mkdirSync, existsSync, readdirSync, readdir } from 'node:fs'
import { copyFile } from 'node:fs/promises'
import {
  appDirectories,
  validImageExtensions,
  WAYPAPER_ENGINE_SOCKET_PATH
} from './globals/globals'
import {
  fileList,
  imagesObject,
  ACTIONS,
  message,
  Monitor,
  imageMetadata
} from './types/types'
import { rendererPlaylist, Image } from '../src/types/rendererTypes'
import { exec, execSync, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { daemonLocation } from './binaries'
import { join, basename } from 'node:path'
import { createConnection } from 'node:net'
import { parseResolution } from '../src/utils/utilities'
import dbOperations from './database/dbOperations'
import config from './database/globalConfig'
import Sharp = require('sharp')
import {
  splitImageHorizontalAxis,
  splitImageVerticalAxis
} from './imageOperations'
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
    return new Promise<imageMetadata | undefined>(async (resolve) => {
      await copyFile(
        imagePaths[currentImage],
        join(appDirectories.imagesDir, imageName)
      )
      const imageMetadata = await createCacheThumbnail(
        imagePaths[currentImage],
        imageName
      )
      resolve(imageMetadata)
    })
  })
  const resolvedObjectsArray = await Promise.allSettled(imagesToStore)
  const imagesToStoreinDB: imageMetadata[] = []
  resolvedObjectsArray.forEach((imagePromise) => {
    if (imagePromise.status === 'fulfilled') {
      const value = imagePromise.value
      if (value) {
        imagesToStoreinDB.push(value)
      }
    }
  })
  return dbOperations.storeImagesInDB(imagesToStoreinDB)
}

async function createCacheThumbnail(filePathSource: string, imageName: string) {
  const [name] = imageName.split('.')
  const fileDestinationPath = join(appDirectories.thumbnails, name + '.webp')
  if (imageName) {
    try {
      const buffer = Sharp(filePathSource, {
        animated: true,
        limitInputPixels: false
      })
      const metadata = await buffer.metadata()
      await buffer
        .resize(300, 200, {
          fit: 'cover'
        })
        .webp({ quality: 60, force: true, effort: 6 })
        .toFile(fileDestinationPath)
      const imageMetadata = {
        name: imageName,
        format: metadata.format,
        width: metadata.width,
        height: metadata.height
      }
      return imageMetadata as imageMetadata
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

export function remakeThumbnailsIfImagesExist() {
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
export function checkCacheOrCreateItIfNotExists() {
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
      appDirectories.thumbnails,
      appDirectories.tempImages
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
  imageName: string,
  monitor?: string
) {
  const command = getSwwwCommandFromConfiguration(
    join(appDirectories.imagesDir, `"${imageName}"`),
    monitor
  )
  try {
    await execPomisified(`${command}`)
  } catch (error) {
    console.error(error)
  }
}

export async function isSwwwDaemonRunning() {
  await checkIfSwwwIsInstalled()
  try {
    execSync('ps -A | grep "swww-daemon"')
    console.log('Swww daemon already running')
  } catch (error) {
    console.log('daemon not running, initiating swww...')
    await execPomisified('swww init')
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
export function savePlaylist(playlistObject: rendererPlaylist) {
  try {
    if (dbOperations.checkIfPlaylistExists(playlistObject.name)) {
      dbOperations.updatePlaylistInDB(playlistObject)
    } else {
      dbOperations.storePlaylistInDB(playlistObject)
    }
    PlaylistController.startPlaylist()
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
      spawn('node', [`${daemonLocation}/daemon.js`], {
        detached: true,
        stdio: 'ignore'
      }).unref()
      console.log('started waypaper daemon succesfully')
    } catch (error) {
      console.error(error)
      console.warn('Could not start waypaper daemon')
    }
  }
}

function playlistConnectionBridge(message: message) {
  try {
    const connection = createConnection(WAYPAPER_ENGINE_SOCKET_PATH)
    connection.write(JSON.stringify(message))
  } catch (error) {
    throw new Error(`${error},could not send daemon message`)
  }
}

export const PlaylistController = {
  startPlaylist: function () {
    playlistConnectionBridge({
      action: ACTIONS.START_PLAYLIST
    })
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
  },
  updatePlaylist: () => {
    playlistConnectionBridge({ action: ACTIONS.UPDATE_PLAYLIST })
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

function getSwwwCommandFromConfiguration(imagePath: string, monitor?: string) {
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
  const command = `swww img ${imagePath} ${
    monitor ? `--outputs ${monitor}` : ''
  } --resize="${swwwConfig.resizeType}" --fill-color "${
    swwwConfig.fillColor
  }" --filter ${swwwConfig.filterType} --transition-type ${
    swwwConfig.transitionType
  } --transition-step ${swwwConfig.transitionStep} --transition-duration ${
    swwwConfig.transitionDuration
  } --transition-fps ${swwwConfig.transitionFPS} --transition-angle ${
    swwwConfig.transitionAngle
  } --transition-pos ${transitionPos} ${inverty} --transition-bezier ${
    swwwConfig.transitionBezier
  } --transition-wave "${swwwConfig.transitionWaveX},${
    swwwConfig.transitionWaveY
  }"`
  return command
}

export async function getMonitors() {
  const { stdout, stderr } = await execPomisified('swww query', {
    encoding: 'utf-8'
  })
  if (stderr) throw new Error('Could not execute swww query')
  return parseSwwwQuery(stdout)
}

function parseSwwwQuery(stdout: string) {
  const monitorsInfoString = stdout.split('\n')
  const monitorsObjectArray = monitorsInfoString
    .filter((monitor) => {
      return monitor !== ''
    })
    .map((monitor, index) => {
      const splitInfo = monitor.split(':')
      const resolutionString = splitInfo[1].split(',')[0].trim()
      const { width, height } = parseResolution(resolutionString)
      return {
        name: splitInfo[0].trim(),
        width,
        height,
        currentImage: splitInfo[4].trim(),
        position: index
      }
    })
  return monitorsObjectArray as Monitor[]
}

export async function setImageExtended(
  Image: Image,
  monitors: Monitor[],
  orientation: 'vertical' | 'horizontal'
) {
  const commands: Promise<any>[] = []
  const imageFilePath = join(appDirectories.imagesDir, Image.name)
  let combinedMonitorHeight: number = 0
  let combinedMonitorWidth: number = 0
  monitors.forEach((monitor) => {
    combinedMonitorHeight += monitor.height
    combinedMonitorWidth += monitor.width
  })
  const monitorsToImagesPair =
    orientation === 'vertical'
      ? await splitImageVerticalAxis(
          monitors,
          Image,
          imageFilePath,
          combinedMonitorWidth
        )
      : await splitImageHorizontalAxis(
          monitors,
          Image,
          imageFilePath,
          combinedMonitorHeight
        )
  monitorsToImagesPair.forEach((pair) => {
    commands.push(
      execPomisified(getSwwwCommandFromConfiguration(pair.image, pair.monitor))
    )
  })
  Promise.all(commands)
}
