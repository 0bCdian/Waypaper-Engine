import { dialog } from 'electron'
import fs, { rmSync } from 'node:fs'
import { copyFile } from 'node:fs/promises'
import {
  appDirectories,
  swwwDefaults,
  validImageExtensions,
  WAYPAPER_SOCKET_PATH
} from './globals/globals'
import { Image, Playlist } from './database/models'
import {
  fileList,
  imagesObject,
  SWWW_VERSION,
  ACTIONS,
  message
} from './types/types'
import { playlist } from '../src/types/rendererTypes'
import { storeImagesInDB, storePlaylistInDB } from './database/dbOperations'
import { exec, execFile, fork } from 'node:child_process'
import { promisify } from 'node:util'
import { execPath, waypaperDaemonPath } from './binaries'
import { join, basename } from 'node:path'
import { createConnection } from 'node:net'

const execPomisified = promisify(exec)
const execFilePromisified = promisify(execFile)
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
      await Playlist.sync({ force: true })
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

export async function setImage(
  _event: Electron.IpcMainInvokeEvent,
  imageName: string
) {
  const options = [...swwwDefaults]
  options.push(join(appDirectories.imagesDir, imageName))
  if (process.env.SWWW_VERSION === SWWW_VERSION.SYSTEM_INSTALLED) {
    try {
      await execPomisified(`swww img ${options.join(' ')}`)
    } catch (error) {
      console.error(error)
    }
  } else {
    try {
      await execFilePromisified(`${join(execPath, 'swww')} img  ${options}`)
    } catch (error) {
      console.error(error)
    }
  }
}
export async function isSwwwDaemonRunning() {
  await checkIfSwwwIsInstalled()
  exec(`ps -A | grep "swww-daemon"`, (_error, stdout, _stderr) => {
    if (!(stdout.toLowerCase().indexOf('swww-daemon'.toLowerCase()) > -1)) {
      isSwwwSocketClean()
      if (process.env.SWWW_VERSION === SWWW_VERSION.SYSTEM_INSTALLED) {
        execPomisified('swww init')
      } else {
        execFile(
          join(execPath, 'swww-daemon'),
          ['&', 'disown'],
          (error, stdout, stderr) => {
            console.error(error, stdout, stderr)
          }
        )
      }
    } else {
      console.log('Daemon already running')
    }
  })
}

function isSwwwSocketClean() {
  //TODO check if I can get around hardcoding the socket path
  const socketPath = '/run/user/1000/swww.socket'
  if (fs.existsSync(socketPath)) {
    rmSync(socketPath)
  }
}

function startPlaylist(playlistName: string, swwwUserOverrides?: string[]) {
  if (process.env.SWWW_VERSION) {
    const swwwOptions =
      swwwUserOverrides !== undefined ? swwwUserOverrides : swwwDefaults
    const swwwBin =
      process.env.SWWW_VERSION === SWWW_VERSION.SYSTEM_INSTALLED
        ? 'swww'
        : join(execPath, 'swww')
    const swwwVersion =
      process.env.SWWW_VERSION === SWWW_VERSION.SYSTEM_INSTALLED
        ? SWWW_VERSION.SYSTEM_INSTALLED
        : SWWW_VERSION.NOT_INSTALLED
    const message: message = {
      action: ACTIONS.START_PLAYLIST,
      payload: {
        playlistName,
        swwwOptions,
        SWWW_VERSION: swwwVersion,
        swwwBin
      }
    }
    playlistConnectionBridge(message)
    PlaylistController.isPlaying = true
  } else {
    throw new Error('Check first if swww is installed')
  }
}

export async function checkIfSwwwIsInstalled() {
  const { stdout } = await execPomisified(`swww --version`)
  if (stdout) {
    console.log('swww is installed in the system')
    process.env.SWWW_VERSION = SWWW_VERSION.SYSTEM_INSTALLED
  } else {
    console.log(
      'swww is not installed, please find instructions in the README.md on how to install it'
    )
    process.env.SWWW_VERSION = SWWW_VERSION.NOT_INSTALLED
  }
}
export async function saveAndInitPlaylist(
  _event: Electron.IpcMainInvokeEvent,
  playlistObject: playlist
) {
  try {
    const playlistAdded = await storePlaylistInDB(playlistObject)
    startPlaylist(playlistAdded.name)
  } catch (error) {
    console.error(error)
    throw Error('Failed to set playlist in DB')
  }
}
async function isWaypaperDaemonRunning() {
  try {
    const { stdout } = await execPomisified('pidof waypaperdaemon')
    console.log('Waypaper daemon already running', stdout)
    return true
  } catch (_err) {
    console.log('Waypaper daemon not running')
    return false
  }
}
export async function initWaypaperDaemon() {
  if (!(await isWaypaperDaemonRunning())) {
    try {
      fork(waypaperDaemonPath)
    } catch (error) {
      console.error(error)
    }
  }
}

async function playlistConnectionBridge(message: message) {
  const connection = createConnection(WAYPAPER_SOCKET_PATH)
  connection.write(JSON.stringify(message))
}

export const PlaylistController = {
  startPlaylist,
  isPlaying: false,
  pausePlaylist: () => {
    playlistConnectionBridge({
      action: ACTIONS.PAUSE_PLAYLIST
    })
    PlaylistController.isPlaying = false
  },
  resumePlaylist: () => {
    playlistConnectionBridge({
      action: ACTIONS.RESUME_PLAYLIST
    })
    PlaylistController.isPlaying = true
  },
  stopPlaylist: () => {
    playlistConnectionBridge({
      action: ACTIONS.STOP_PLAYLIST
    })
    PlaylistController.isPlaying = false
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
  }
}
