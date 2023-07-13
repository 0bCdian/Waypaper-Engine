import { execFile } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'

interface playlist {
  name: string
  imagesList: string[]
  currentImageIndex: number
  interval: number
}

interface message {
  playlistObject: playlist
  swwwBin: string
  swwwConfig: string[]
  appDirectories: {
    systemHome: string
    rootCache: string
    thumbnails: string
    mainDir: string
    imagesDir: string
    playlistsDir: string
  }
}
//tiene que llegar, configs del swww, el playlist object, path to swww, appDirpath

process.on('message', (message: message) => {
  playlistPlayer(message)
})

function setImage(swwwConfigs: string[], imagePath: string, swwwBin: string) {
  const optionsToPass = [...swwwConfigs]
  console.log(imagePath)
  optionsToPass.push(imagePath)
  execFile(swwwBin, optionsToPass, (error) => {
    console.log(error)
  })
}

function playlistPlayer(message: message) {
  setInterval(() => {
    setImage(
      message.swwwConfig,
      `${message.appDirectories.imagesDir}${
        message.playlistObject.imagesList[
          message.playlistObject.currentImageIndex
        ]
      }`,
      message.swwwBin
    )
    if (
      message.playlistObject.currentImageIndex ===
      message.playlistObject.imagesList.length
    ) {
      message.playlistObject.currentImageIndex = 0
    } else {
      message.playlistObject.currentImageIndex++
    }
  }, message.playlistObject.interval)
}
