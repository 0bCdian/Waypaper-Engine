import os from 'node:os'

const cacheDirectoryRoot = os.homedir() + '/.cache/waypaper/'
const cacheThumbnailsDirectory = cacheDirectoryRoot + 'thumbnails/'
const mainDirectory = os.homedir() + '/.waypaper/'
const imagesDir = mainDirectory + 'images/'

export const appDirectories = {
  systemHome: os.homedir(),
  rootCache: cacheDirectoryRoot,
  thumbnails: cacheThumbnailsDirectory,
  mainDir: mainDirectory,
  imagesDir: imagesDir
}

export const swwwDefaults =
  '--transition-bezier .43,1.19,1,.4 --transition-type grow --transition-fps 60 --transition-duration 1 --transition-pos top-right'
