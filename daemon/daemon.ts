import { createServer } from 'node:net'
import { Sequelize } from 'sequelize'
import { unlinkSync } from 'node:fs'
import { execSync, exec } from 'node:child_process'
import { join } from 'node:path'
import { homedir } from 'node:os'
import {
  PlaylistTypeDB,
  message,
  PlaylistParsed,
  PLAYLIST_TYPES,
  PlaylistInterface,
  ACTIONS,
  PlaylistStates
} from './typesDaemon'

function isWaypaperDaemonRunning() {
  try {
    const stdout = execSync('pidof wp-daemon', { encoding: 'utf-8' })
    console.log('Waypaper daemon already running', stdout)
    return true
  } catch (_err) {
    console.log('Waypaper daemon not running')
    return false
  }
}

if (isWaypaperDaemonRunning()) {
  notify('Another instance of the daemon is already running, exiting...')
  process.exit(1)
}
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: join(homedir(), '.waypaper', 'imagesDB.sqlite3')
})

const IMAGES_DIR = join(homedir(), '.waypaper', 'images')
const SOCKET_PATH = '/tmp/waypaper_daemon.sock'
const setImage = (swwwOptions: string[], imageName: string) => {
  notifyImageSet(imageName, join(IMAGES_DIR, imageName))
  execSync(`swww img ${swwwOptions.join(' ')} "${join(IMAGES_DIR, imageName)}"`)
}
function notifyImageSet(imageName: string, imagePath: string) {
  const notifySend = `notify-send -u low -t 2000 -i "${imagePath}" -a "Waypaper" "Waypaper" "Setting image: ${imageName}"`
  exec(notifySend, (err, _stdout, _stderr) => {
    if (err) {
      console.error(err)
    }
  })
}

function notifyPlaylistState(
  playlistName: string,
  playlistState: PlaylistStates
) {
  let message = ''
  switch (playlistState) {
    case PlaylistStates.PLAYING:
      message = `Playing playlist: ${playlistName}`
      break
    case PlaylistStates.PAUSED:
      message = `Paused playlist: ${playlistName}`
      break
    case PlaylistStates.STOPPED:
      message = `Stopping playlist: ${playlistName}`
  }
  const notifySend = `notify-send -u low -t 2000 -i "waypaper" -a "Waypaper" "Waypaper" "${message}"`
  exec(notifySend, (err, _stdout, _stderr) => {
    if (err) {
      console.error(err)
    }
  })
}
function notify(message: string) {
  const notifySend = `notify-send -u normal -t 2000 -i "waypaper" -a "Waypaper" "Waypaper" "${message}"`
  exec(notifySend, (err, _stdout, _stderr) => {
    if (err) {
      console.error(err)
    }
  })
}

const Playlist: PlaylistInterface = {
  images: [''],
  currentName: '',
  currentType: PLAYLIST_TYPES.NEVER,
  currentImageIndex: 0,
  interval: 0,
  intervalID: null,
  swwwOptions: [''],
  pause: () => {
    if (
      Playlist.intervalID !== null &&
      Playlist.currentType !== PLAYLIST_TYPES.NEVER
    ) {
      clearInterval(Playlist.intervalID)
      Playlist.intervalID = null
    }
  },
  resume: () => {
    if (
      Playlist.intervalID === null &&
      Playlist.currentType !== PLAYLIST_TYPES.NEVER
    ) {
      // Switch statement to determine which interval playlist type to use, rn only timed playist is implemented
      Playlist.timedPlaylist()
    }
  },
  stop: () => {
    clearInterval(Playlist.intervalID as NodeJS.Timeout)
    Playlist.intervalID = null
    Playlist.pause()
    Playlist.currentImageIndex = 0
    Playlist.currentName = ''
    Playlist.currentType = PLAYLIST_TYPES.NEVER
    Playlist.interval = 0
    Playlist.images = ['']
    Playlist.swwwOptions = ['']
  },
  resetInterval: () => {
    if (Playlist.intervalID) {
      clearInterval(Playlist.intervalID)
      Playlist.intervalID = null
      Playlist.timedPlaylist()
    }
  },
  nextImage: () => {
    Playlist.resetInterval()
    Playlist.currentImageIndex++
    if (Playlist.currentImageIndex === Playlist.images.length) {
      Playlist.currentImageIndex = 0
    }
    setImage(Playlist.swwwOptions, Playlist.images[Playlist.currentImageIndex])
    Playlist.updateInDB(Playlist.currentImageIndex, Playlist.currentName)
  },
  previousImage: () => {
    Playlist.resetInterval()
    Playlist.currentImageIndex--
    if (Playlist.currentImageIndex < 0) {
      Playlist.currentImageIndex = Playlist.images.length - 1
    }
    setImage(Playlist.swwwOptions, Playlist.images[Playlist.currentImageIndex])
    Playlist.updateInDB(Playlist.currentImageIndex, Playlist.currentName)
  },
  calculateInterval: (hours: number, minutes: number) => {
    return hours * 60 * 60 * 1000 + minutes * 60 * 1000
  },
  start: async (playlistName: string, swwwOptions: string[]) => {
    await Playlist.setPlaylist(playlistName, swwwOptions)
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
        console.error('Invalid playlist type')
        notify('Invalid playlist type')
        Playlist.stop()
        return
    }
  },
  sleep: (ms: number) => new Promise((r) => setTimeout(r, ms)),
  updateInDB: async (imageIndex: number, playlistName: string) => {
    try {
      await sequelize.query(
        `UPDATE Playlists SET currentImageIndex = ${imageIndex} WHERE name = '${playlistName}'`
      )
    } catch (error) {
      console.error(error)
      notify(
        'Could not update playlist in DB, restart the app to restore the database'
      )
      notify('Exiting daemon')
      throw new Error('Could not update playlist in DB')
    }
  },
  getFromDB: async (playlistName: string) => {
    try {
      const [playlistArray] = (await sequelize.query(
        `SELECT * FROM Playlists WHERE name = '${playlistName}'`
      )) as PlaylistTypeDB[][]
      if (!playlistArray.length) {
        console.error('Playlist not found')
        notify('Playlist not found, maybe it was deleted?')
        notify('Exiting daemon')
        throw new Error('Playlist not found')
      }
      playlistArray[0].images = JSON.parse(playlistArray[0].images)
      return playlistArray[0] as unknown as PlaylistParsed
    } catch (error) {
      console.error(error)
      notify('Exiting daemon')
      throw new Error('Could not get playlist from DB')
    }
  },
  setPlaylist: async (
    playlistName: string,

    swwwOptions: string[]
  ) => {
    try {
      const currentPlaylist = await Playlist.getFromDB(playlistName)
      Playlist.images = currentPlaylist.images
      Playlist.currentName = playlistName
      Playlist.swwwOptions = swwwOptions
      Playlist.currentType = currentPlaylist.type
      Playlist.currentImageIndex = currentPlaylist.currentImageIndex
      Playlist.interval = Playlist.calculateInterval(
        currentPlaylist.hours,
        currentPlaylist.minutes
      )
    } catch (error) {
      console.error(error)
      // implement notify function
      throw new Error('Could not set playlist')
    }
  },
  timedPlaylist: async () => {
    Playlist.intervalID = setInterval(async () => {
      Playlist.currentImageIndex++
      if (Playlist.currentImageIndex === Playlist.images.length) {
        Playlist.currentImageIndex = 0
      }
      setImage(
        Playlist.swwwOptions,
        Playlist.images[Playlist.currentImageIndex]
      )
      await Playlist.updateInDB(
        Playlist.currentImageIndex,
        Playlist.currentName
      )
    }, Playlist.interval)
  },
  neverPlaylist: async () => {
    setImage(Playlist.swwwOptions, Playlist.images[Playlist.currentImageIndex])
  },
  timeOfDayPlaylist: async () => {},
  dayOfWeekPlaylist: async () => {}
}

async function daemonInit() {
  process.title = 'wp-daemon'
  await sequelize.authenticate()
  async function daemonManager(data: Buffer) {
    const message: message = JSON.parse(data.toString())
    if (message.action === ACTIONS.STOP_DAEMON) {
      notify('Exiting daemon')
      Playlist.stop()
      sequelize.close()
      daemonServer.close()
      process.exit(0)
    } else {
      if (Playlist.currentName === '') {
        notify('No active playlist')
        return
      }
      if (message.action === ACTIONS.START_PLAYLIST && message.payload) {
        Playlist.stop()
        await Playlist.start(
          message.payload.playlistName,
          message.payload.swwwOptions
        )
        notifyPlaylistState(Playlist.currentName, PlaylistStates.PLAYING)
      }
      if (message.action === ACTIONS.PAUSE_PLAYLIST) {
        Playlist.pause()
        notifyPlaylistState(Playlist.currentName, PlaylistStates.PAUSED)
      }
      if (message.action === ACTIONS.RESUME_PLAYLIST) {
        Playlist.resume()
        notifyPlaylistState(Playlist.currentName, PlaylistStates.PLAYING)
      }
      if (message.action === ACTIONS.STOP_PLAYLIST) {
        Playlist.stop()
        notifyPlaylistState(Playlist.currentName, PlaylistStates.STOPPED)
      }
      if (message.action === ACTIONS.NEXT_IMAGE) {
        Playlist.nextImage()
      }
      if (message.action === ACTIONS.PREVIOUS_IMAGE) {
        Playlist.previousImage()
      }
    }
  }
  const daemonServer = createServer((socket) => {
    socket.on('data', daemonManager)
  })

  daemonServer.on('error', (err) => {
    if (err.message.includes('EADDRINUSE')) {
      unlinkSync(SOCKET_PATH)
      daemonServer.listen(SOCKET_PATH)
    } else {
      console.error(err)
    }
  })

  daemonServer.listen(SOCKET_PATH)
  process.on('SIGTERM', function () {
    notify('Exiting daemon')
    Playlist.stop()
    sequelize.close()
    daemonServer.close()
    process.exit(0)
  })
  process.on('SIGINT', () => {
    notify('Exiting daemon')
    Playlist.stop()
    sequelize.close()
    daemonServer.close()
    process.exit(0)
  })
}

daemonInit()
