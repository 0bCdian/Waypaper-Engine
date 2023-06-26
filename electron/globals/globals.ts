import os from 'node:os'

const cacheDirectoryPath = os.homedir() + '/.cache/waypaper'
const cacheThumbnailDirectory = cacheDirectoryPath + '/thumbnails'
const cacheImageDirectory = cacheDirectoryPath + '/images'

export const cacheDirectory = {
  root: cacheDirectoryPath + '/',
  thumbnails: cacheThumbnailDirectory + '/',
  Images: cacheImageDirectory + '/'
}
