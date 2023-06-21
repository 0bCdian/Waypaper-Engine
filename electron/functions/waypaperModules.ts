import fs from 'fs'
import os from 'os'

async function checkIfFolderExist() {
  const cacheDirectoryPath = os.homedir() + '/.cache/waypaper'
  const cacheThumbnailDirectory = cacheDirectoryPath + 'thumbnails'
  const cacheImageDirectory = cacheDirectoryPath + 'images'
  if (fs.existsSync(cacheDirectoryPath)) {
    console.log(
      cacheDirectoryPath,
      cacheImageDirectory,
      cacheThumbnailDirectory
    )
  }
}
