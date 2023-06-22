import fs from 'fs'
import os from 'os'

export function checkCacheAndCreateItIfNotExists() {
  const cacheDirectoryPath = os.homedir() + '/.cache/waypaper'
  const cacheThumbnailDirectory = cacheDirectoryPath + '/thumbnails'
  const cacheImageDirectory = cacheDirectoryPath + '/images'
  if (!fs.existsSync(cacheDirectoryPath)) {
    createFolders(
      cacheDirectoryPath,
      cacheImageDirectory,
      cacheThumbnailDirectory
    )
  } else {
    if (!fs.existsSync(cacheImageDirectory)) {
      createFolders(cacheImageDirectory, cacheThumbnailDirectory)
    } else if (!fs.existsSync(cacheThumbnailDirectory)) {
      createFolders(cacheThumbnailDirectory)
    }
  }
}

export function createFolders(...args: string[]) {
  try {
    args.forEach((path) => {
      fs.mkdirSync(path)
    })
  } catch (error) {
    console.error(error)
  }
}
