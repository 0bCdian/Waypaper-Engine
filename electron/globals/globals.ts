import os from 'node:os'
import { join } from 'node:path'
const systemHome = os.homedir()
const cacheDirectoryRoot = join(systemHome, '.cache', 'waypaper')
const cacheThumbnailsDirectory = join(cacheDirectoryRoot, 'thumbnails')
const mainDirectory = join(systemHome, '.waypaper')
const imagesDir = join(mainDirectory, 'images')
const playlistsDir = join(mainDirectory, 'playlists')

export const appDirectories = {
  systemHome: systemHome,
  rootCache: cacheDirectoryRoot,
  thumbnails: cacheThumbnailsDirectory,
  mainDir: mainDirectory,
  imagesDir: imagesDir,
  playlistsDir: playlistsDir
}


export const swwwDefaults = [
  'img',
  '--transition-fps',
  '60',
  '--transition-duration',
  '1',
  '--transition-type',
  'wipe'
]
export const validImageExtensions = [
  'jpeg',
  'jpg',
  'png',
  'gif',
  'bmp',
  'webp',
  'pnm',
  'tga',
  'tiff',
  'farbfeld'
]

