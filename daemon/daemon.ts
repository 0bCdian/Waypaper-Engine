import { PlaylistType } from '../electron/types/types'

interface message {
  playlistObject: PlaylistType
  swwwOptions: string[]
  SWWW_VERSION: string
  swwwBin: string
}

try {
  process.on('message', (message: message) => {
    console.log(message)
  })
} catch (error) {
  console.error(error)
  throw new Error('Failed to connect to DB, exiting playlist daemon...')
}
