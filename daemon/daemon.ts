import { Sequelize } from 'sequelize'
import * as net from 'node:net'
import * as fs from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'
import { homedir } from 'node:os'
import process from 'node:process'

process.title = 'waypaperdaemon'

enum SWWW_VERSION {
  SYSTEM_INSTALLED = 'system-installed',
  NOT_INSTALLED = 'not-installed'
}
enum PLAYLIST_TYPES {
  TIMER = 'timer',
  NEVER = 'never',
  TIME_OF_DAY = 'timeofday',
  DAY_OF_WEEK = 'dayofweek'
}
enum ORDER_TYPES {
  ORDERED = 'ordered',
  RANDOM = 'random'
}
type PlaylistType = {
  id: number
  name: string
  images: string
  type: PLAYLIST_TYPES
  hours: number
  minutes: number
  order: ORDER_TYPES
  showTransition: boolean
  currentImageIndex: number
}

type PlaylistParsed = {
  id: number
  name: string
  images: string[]
  type: PLAYLIST_TYPES
  hours: number
  minutes: number
  order: ORDER_TYPES
  showTransition: boolean
  currentImageIndex: number
}

interface message {
  action: ACTIONS
  payload?: {
    playlistName: string
    swwwOptions: string[]
    SWWW_VERSION: SWWW_VERSION
    swwwBin: string
  }
}
enum ACTIONS {
  NEXT_IMAGE = 'next-image',
  PREVIOUS_IMAGE = 'previous-image',
  START_PLAYLIST = 'start-playlist',
  STOP_DAEMON = 'stop-daemon',
  PAUSE_PLAYLIST = 'pause-playlist'
}

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: join(homedir(), '.waypaper', 'imagesDB.sqlite3')
})
const IMAGES_DIR = join(homedir(), '.waypaper', 'images')
const SOCKET_PATH = '/tmp/waypaper_daemon.sock'
const setImage = (
  swwwBin: string,
  swwwOptions: string[],
  imageName: string
) => {
  console.log('Setting image: ', imageName)
  console.log('swwwBin: ', swwwBin)
  console.log('swwwOptions: ', swwwOptions)
  execSync(
    `${swwwBin} img ${swwwOptions.join(' ')} "${join(IMAGES_DIR, imageName)}"`
  )
}
const Playlist = {
  state: false,
  images: [''],
  currentName: '',
  currentType: PLAYLIST_TYPES.NEVER,
  currentImageIndex: 0,
  interval: 0,
  swwwBin: '',
  swwwOptions: [''],
  pause: () => {
    Playlist.state = false
  },
  resume: () => {
    Playlist.start(Playlist.currentName, Playlist.swwwBin, Playlist.swwwOptions)
  },
  stop: () => {
    Playlist.state = false
    Playlist.currentImageIndex = 0
    Playlist.currentName = ''
    Playlist.currentType = PLAYLIST_TYPES.NEVER
    Playlist.interval = 0
    Playlist.images = ['']
    Playlist.swwwBin = ''
    Playlist.swwwOptions = ['']
  },
  nextImage: () => {
    Playlist.currentImageIndex++
    if (Playlist.currentImageIndex === Playlist.images.length) {
      Playlist.currentImageIndex = 0
    }
    setImage(
      Playlist.swwwBin,
      Playlist.swwwOptions,
      Playlist.images[Playlist.currentImageIndex]
    )
  },
  previousImage: () => {
    Playlist.currentImageIndex--
    if (Playlist.currentImageIndex < 0) {
      Playlist.currentImageIndex = Playlist.images.length - 1
    }
    setImage(
      Playlist.swwwBin,
      Playlist.swwwOptions,
      Playlist.images[Playlist.currentImageIndex]
    )
  },
  calculateInterval: (hours: number, minutes: number) => {
    return hours * 60 * 60 * 1000 + minutes * 60 * 1000
  },
  start: async (
    playlistName: string,
    swwwBin: string,
    swwwOptions: string[]
  ) => {
    await Playlist.setPlaylist(playlistName, swwwBin, swwwOptions)
    switch (Playlist.currentType) {
      case PLAYLIST_TYPES.TIMER:
        Playlist.timedPlaylist()
        break
      case PLAYLIST_TYPES.NEVER:
        Playlist.neverPlaylist()
        break
      case PLAYLIST_TYPES.TIME_OF_DAY:
        Playlist.timeOfDayPlaylist()
        break
      case PLAYLIST_TYPES.DAY_OF_WEEK:
        Playlist.dayOfWeekPlaylist()
        break
      default:
        throw new Error('Invalid playlist type')
    }
  },
  sleep: (ms: number) => new Promise((r) => setTimeout(r, ms)),
  updateInDB: async (imageIndex: number, playlistName: string) => {
    try {
      await sequelize.authenticate()
      await sequelize.query(
        `UPDATE Playlists SET currentImageIndex = ${imageIndex} WHERE name = '${playlistName}'`
      )
    } catch (error) {
      console.error(error)
      throw new Error('Could not update playlist in DB')
    }
  },
  getFromDB: async (playlistName: string) => {
    try {
      await sequelize.authenticate()
      const [playlistArray] = (await sequelize.query(
        `SELECT * FROM Playlists WHERE name = '${playlistName}'`
      )) as PlaylistType[][]
      if (!playlistArray.length) throw new Error('Playlist not found')
      playlistArray[0].images = JSON.parse(playlistArray[0].images)
      return playlistArray[0] as unknown as PlaylistParsed
    } catch (error) {
      console.error(error)
      throw new Error('Could not get playlist from DB')
    }
  },
  setPlaylist: async (
    playlistName: string,
    swwwBin: string,
    swwwOptions: string[]
  ) => {
    try {
      const currentPlaylist = await Playlist.getFromDB(playlistName)
      Playlist.state = true
      Playlist.images = currentPlaylist.images
      Playlist.currentName = playlistName
      Playlist.swwwBin = swwwBin
      Playlist.swwwOptions = swwwOptions
      Playlist.currentType = currentPlaylist.type
      Playlist.currentImageIndex = currentPlaylist.currentImageIndex
      Playlist.interval = Playlist.calculateInterval(
        currentPlaylist.hours,
        currentPlaylist.minutes
      )
      console.log('Playlist set')
      console.log(Playlist.images, Playlist.currentImageIndex)
    } catch (error) {
      console.error(error)
      // implement notify function
      throw new Error('Could not set playlist')
    }
  },
  timedPlaylist: async () => {
    console.log(
      'timedPlaylist',
      Playlist.currentImageIndex,
      Playlist.images,
      Playlist.currentName
    )
    setImage(
      Playlist.swwwBin,
      Playlist.swwwOptions,
      Playlist.images[Playlist.currentImageIndex]
    )
    while (Playlist.state) {
      await Playlist.sleep(Playlist.interval)
      Playlist.currentImageIndex++
      if (Playlist.currentImageIndex === Playlist.images.length) {
        Playlist.currentImageIndex = 0
      }
      setImage(
        Playlist.swwwBin,
        Playlist.swwwOptions,
        Playlist.images[Playlist.currentImageIndex]
      )
      await Playlist.updateInDB(
        Playlist.currentImageIndex,
        Playlist.currentName
      )
    }
  },
  neverPlaylist: async () => {
    setImage(
      Playlist.swwwBin,
      Playlist.swwwOptions,
      Playlist.images[Playlist.currentImageIndex]
    )
  },
  timeOfDayPlaylist: async () => {},
  dayOfWeekPlaylist: async () => {}
}

async function daemonManager(data: Buffer) {
  const message: message = JSON.parse(data.toString())
  if (message.action === ACTIONS.START_PLAYLIST && message.payload) {
    Playlist.stop()
    await Playlist.start(
      message.payload.playlistName,
      message.payload.swwwBin,
      message.payload.swwwOptions
    )
  }
  if (message.action === ACTIONS.PAUSE_PLAYLIST) {
    Playlist.pause()
  }
  if (message.action === ACTIONS.NEXT_IMAGE) {
    Playlist.nextImage()
  }
  if (message.action === ACTIONS.PREVIOUS_IMAGE) {
    Playlist.previousImage()
  }
  if (message.action === ACTIONS.STOP_DAEMON) {
    Playlist.stop()
    sequelize.close()
    daemonServer.close()
  }
}

const daemonServer = net.createServer((socket) => {
  socket.on('data', daemonManager)
})

daemonServer.on('error', (err) => {
  if (err.message.includes('EADDRINUSE')) {
    fs.unlinkSync(SOCKET_PATH)
    daemonServer.listen(SOCKET_PATH)
  } else {
    console.error(err)
  }
})

daemonServer.listen(SOCKET_PATH)
process.on('SIGTERM', function () {
  daemonServer.close()
})
process.on('SIGINT', () => {
  daemonServer.close()
})
