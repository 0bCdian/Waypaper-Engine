import os from 'node:os'

const cacheDirectoryRoot = os.homedir() + '/.cache/waypaper/'
const cacheThumbnailsDirectory = cacheDirectoryRoot + 'thumbnails/'
const mainDirectory = os.homedir() + '/.waypaper/'
const imagesDir = mainDirectory + 'images'

export const appDirectories = {
  rootCache: cacheDirectoryRoot,
  thumbnails: cacheThumbnailsDirectory,
  mainDir: mainDirectory,
  imagesDir: imagesDir
}
