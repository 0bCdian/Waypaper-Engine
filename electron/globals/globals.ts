import os from 'node:os'
const systemHome = os.homedir()
const cacheDirectoryRoot = systemHome + '/.cache/waypaper/'
const cacheThumbnailsDirectory = cacheDirectoryRoot + 'thumbnails/'
const mainDirectory = systemHome + '/.waypaper/'
const imagesDir = mainDirectory + 'images/'
const playlistsDir = mainDirectory + 'playlists'

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
  '--transition-bezier',
  '.43,1.19,1,.4',
  '--transition-type',
  'grow',
  '--transition-fps',
  '60',
  '--transition-duration',
  '1',
  '--transition-pos',
  'top-right'
]
