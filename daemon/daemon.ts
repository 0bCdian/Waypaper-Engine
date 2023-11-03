import { createServer } from 'node:net'
import { unlinkSync } from 'node:fs'
import { execSync, exec } from 'node:child_process'
import { join } from 'node:path'
import { homedir } from 'node:os'
import {
  message,
  PLAYLIST_TYPES,
  PlaylistInterface,
  ACTIONS
} from './typesDaemon'
import dbOperations from './dbOperationsDaemon'
import configuration from './config'

function checkIfSwwwIsInstalled() {
  const stdout = execSync(`swww --version`, { encoding: 'utf-8' })
  if (stdout) {
    console.info('swww is installed in the system')
  } else {
    console.warn(
      'swww is not installed, please find instructions in the README.md on how to install it'
    )
    throw new Error('swww is not installed')
  }
}
function isSwwwDaemonRunning() {
  checkIfSwwwIsInstalled()
  try {
    const stdout = execSync(`ps -A | grep "swww-daemon"`, { encoding: 'utf-8' })
    console.log('Swww Daemon already running', stdout)
  } catch (error) {
    console.log('Starting swww...')
    execSync('swww init', { shell: '/bin/sh' })
  }
}

function isWaypaperDaemonRunning() {
  try {
    const stdout = execSync('pidof wpe-daemon', { encoding: 'utf-8' })
    if (configuration.app.settings.notifications) {
      notify(`Waypaper Engine daemon already running, ${stdout}`)
    }
    return true
  } catch (_err) {
    console.info('Starting waypaper engine daemon...')
    return false
  }
}

if (isWaypaperDaemonRunning()) {
  if (configuration.app.settings.notifications) {
    notify('Another instance of the daemon is already running, exiting...')
  }
  process.exit(1)
} else {
  isSwwwDaemonRunning()
}

const IMAGES_DIR = join(homedir(), '.waypaper_engine', 'images')
const SOCKET_PATH = '/tmp/waypaper_engine_daemon.sock'

function getSwwwCommandFromConfiguration(
  imagePath: string,
  monitors?: string[]
) {
  const swwwConfig = configuration.swww.settings
  let transitionPos = ''
  let inverty = swwwConfig.invertY ? '--invert-y' : ''
  switch (swwwConfig.transitionPositionType) {
    case 'int':
      transitionPos = `${swwwConfig.transitionPositionIntX},${swwwConfig.transitionPositionIntY}`
      break
    case 'float':
      transitionPos = `${swwwConfig.transitionPositionFloatX},${swwwConfig.transitionPositionFloatY}`
      break
    case 'alias':
      transitionPos = swwwConfig.transitionPosition
  }
  if (!monitors) {
    const baseCommand = `swww img "${imagePath}" --resize="${swwwConfig.resizeType}" --fill-color "${swwwConfig.fillColor}" --filter ${swwwConfig.filterType} --transition-step ${swwwConfig.transitionStep} --transition-duration ${swwwConfig.transitionDuration} --transition-fps ${swwwConfig.transitionFPS} --transition-angle ${swwwConfig.transitionAngle} --transition-pos ${transitionPos} ${inverty} --transition-bezier ${swwwConfig.transitionBezier} --transition-wave "${swwwConfig.transitionWaveX},${swwwConfig.transitionWaveY}"`
    if (
      !configuration.app.settings.swwwAnimations ||
      !Playlist.showAnimations
    ) {
      const command = baseCommand.concat(' --transition-type=none')
      return command
    } else {
      const command = baseCommand.concat(
        ` --transition-type=${swwwConfig.transitionType}`
      )
      return command
    }
  }
}

function notifyImageSet(imageName: string, imagePath: string) {
  if (!configuration.app.settings.notifications) return
  const notifySend = `notify-send -u low -t 2000 -i "${imagePath}" -a "Waypaper Engine" "Waypaper Engine" "Setting image: ${imageName}"`
  exec(notifySend, (err, _stdout, _stderr) => {
    if (err) {
      console.error(err)
    }
  })
}

function notify(message: string) {
  if (!configuration.app.settings.notifications) return
  const notifySend = `notify-send -u normal -t 2000 -a "Waypaper Engine" "Waypaper Engine" "${message}"`
  exec(notifySend, (err, _stdout, _stderr) => {
    if (err) {
      console.error(err)
    }
  })
}
type newPlaylist = ReturnType<typeof dbOperations.getCurrentPlaylist>
function comparePlaylists(newPlaylist: newPlaylist) {
  if (
    !newPlaylist ||
    Playlist.currentName !== newPlaylist.name ||
    Playlist.currentType !== newPlaylist.type ||
    Playlist.interval !== newPlaylist.interval ||
    newPlaylist.type === PLAYLIST_TYPES.TIME_OF_DAY
  ) {
    return false
  } else {
    return true
  }
}
function findImageIndexRelativeToNow() {
  const date = new Date()
  const nowTime = date.getHours() * 60 + date.getMinutes()
  let lowestPoint = 0
  let highestPoint = Playlist.images.length
  let closestIndex: number = highestPoint - 1
  do {
    const midPoint = Math.floor(lowestPoint + (highestPoint - lowestPoint) / 2)
    const currentTimeStamp = Playlist.images[midPoint].time
    console.log(currentTimeStamp)
    if (currentTimeStamp === null) return undefined
    if (currentTimeStamp === nowTime) {
      closestIndex = midPoint
      break
    } else if (currentTimeStamp > nowTime) {
      highestPoint = midPoint
      closestIndex = midPoint
    } else {
      lowestPoint = midPoint + 1
      closestIndex = midPoint
    }
  } while (lowestPoint < highestPoint)
  return closestIndex
}

function calculateMillisecondsUntilNextImage() {
  let nextIndex =
    Playlist.currentImageIndex + 1 === Playlist.images.length
      ? 0
      : Playlist.currentImageIndex + 1
  const nextTime = Playlist.images[nextIndex].time
  if (nextTime === null) throw new Error('Image doesnt have time')
  const date = new Date()
  const nowInMinutes = date.getHours() * 60 + date.getMinutes()
  let time = nextTime - nowInMinutes
  let shouldSetRightAway = false
  if (time < 0) {
    time += 1440
    shouldSetRightAway = true
  }
  time = 60 * time
  time = time - date.getSeconds()
  time = time * 1000
  return { time, shouldSetRightAway }
}
function timeOfDayPlayer() {
  const { time: timeOut, shouldSetRightAway } =
    calculateMillisecondsUntilNextImage()
  if (shouldSetRightAway) {
    Playlist.setImage(Playlist.images[Playlist.currentImageIndex].name)
  }
  console.log(timeOut, 'time until next image')
  Playlist.timeoutID = setTimeout(() => {
    Playlist.setImage(Playlist.images[Playlist.currentImageIndex].name)
    let newIndex = Playlist.currentImageIndex + 1
    if (newIndex === Playlist.images.length) {
      newIndex = 0
    }
    Playlist.currentImageIndex = newIndex
    timeOfDayPlayer()
  }, timeOut)
}
const Playlist: PlaylistInterface = {
  images: [],
  currentName: '',
  currentType: undefined,
  currentImageIndex: 0,
  interval: 0,
  showAnimations: true,
  intervalID: undefined,
  timeoutID: undefined,
  setImage: (imageName: string) => {
    const command = getSwwwCommandFromConfiguration(join(IMAGES_DIR, imageName))
    if (command) {
      notifyImageSet(imageName, join(IMAGES_DIR, imageName))
      execSync(command)
    }
  },
  pause: () => {
    clearInterval(Playlist.intervalID)
    clearTimeout(Playlist.timeoutID)
    Playlist.intervalID = undefined
    Playlist.timeoutID = undefined
  },
  resume: () => {
    if (Playlist.currentType === PLAYLIST_TYPES.TIMER) {
      Playlist.timedPlaylist(true)
    }
  },
  stop: () => {
    Playlist.pause()
    Playlist.currentImageIndex = 0
    Playlist.currentName = ''
    Playlist.currentType = undefined
    Playlist.interval = 0
    Playlist.images = []
    Playlist.showAnimations = true
  },
  resetInterval: () => {
    clearInterval(Playlist.intervalID)
    Playlist.intervalID = undefined
    Playlist.timedPlaylist()
  },
  nextImage: () => {
    Playlist.currentImageIndex++
    if (Playlist.currentImageIndex === Playlist.images.length) {
      Playlist.currentImageIndex = 0
    }
    if (Playlist.currentType === PLAYLIST_TYPES.TIMER) {
      Playlist.resetInterval()
    } else {
      Playlist.setImage(Playlist.images[Playlist.currentImageIndex].name)
    }
    Playlist.updateInDB(Playlist.currentImageIndex, Playlist.currentName)
  },
  previousImage: () => {
    Playlist.currentImageIndex--
    if (Playlist.currentImageIndex < 0) {
      Playlist.currentImageIndex = Playlist.images.length - 1
    }
    if (Playlist.currentType === PLAYLIST_TYPES.TIMER) {
      Playlist.resetInterval()
    } else {
      Playlist.setImage(Playlist.images[Playlist.currentImageIndex].name)
    }
    Playlist.updateInDB(Playlist.currentImageIndex, Playlist.currentName)
  },
  start: () => {
    const shouldNotStart = Playlist.setPlaylist()
    if (!shouldNotStart) {
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
          Playlist.stop()
          return
      }
    }
  },
  updateInDB: (imageIndex: number, playlistName: string) => {
    try {
      dbOperations.updatePlaylistCurrentIndex(imageIndex, playlistName)
    } catch (error) {
      console.error(error)
      notify(
        'Could not update playlist in DB, restart the app to restore the database'
      )
      notify('Exiting daemon')
      throw new Error('Could not update playlist in DB')
    }
  },
  setPlaylist: () => {
    try {
      const currentPlaylist = dbOperations.getCurrentPlaylist()
      if (currentPlaylist === null) {
        return false
      }
      const areTheSame = comparePlaylists(currentPlaylist)
      if (!areTheSame) {
        Playlist.stop()
      }
      Playlist.images = currentPlaylist.images
      Playlist.currentName = currentPlaylist.name
      Playlist.currentType = currentPlaylist.type
      Playlist.currentImageIndex = configuration.app.settings
        .playlistStartOnFirstImage
        ? 0
        : currentPlaylist.currentImageIndex
      Playlist.interval = currentPlaylist.interval
      Playlist.showAnimations = currentPlaylist.showAnimations
      return areTheSame
    } catch (error) {
      console.error(error)
      throw new Error('Could not set playlist')
    }
  },
  timedPlaylist: (resume) => {
    if (Playlist.interval !== null) {
      if (!resume) {
        Playlist.setImage(Playlist.images[Playlist.currentImageIndex].name)
      }
      Playlist.intervalID = setInterval(() => {
        Playlist.currentImageIndex++
        if (Playlist.currentImageIndex === Playlist.images.length) {
          Playlist.currentImageIndex = 0
        }
        Playlist.setImage(Playlist.images[Playlist.currentImageIndex].name)
        Playlist.updateInDB(Playlist.currentImageIndex, Playlist.currentName)
      }, Playlist.interval)
    } else {
      console.error('Interval is null')
      notify('Interval is null, something went wrong setting the playlist')
    }
  },
  neverPlaylist: () => {
    Playlist.setImage(Playlist.images[Playlist.currentImageIndex].name)
  },
  timeOfDayPlaylist: () => {
    const startingIndex = findImageIndexRelativeToNow()
    console.log(startingIndex, 'closest index')
    if (startingIndex === undefined) {
      throw new Error('Images have no time, something went wrong')
    } else {
      Playlist.currentImageIndex = startingIndex
      timeOfDayPlayer()
    }
  },
  dayOfWeekPlaylist: () => {
    const now = new Date()
    const endOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0,
      0,
      0
    )
    const millisecondsUntilEndOfDay = endOfDay.getTime() - now.getTime()
    Playlist.setImage(Playlist.images[now.getDay()].name)
    Playlist.intervalID = setTimeout(() => {
      Playlist.dayOfWeekPlaylist()
    }, millisecondsUntilEndOfDay)
  }
}

function daemonInit() {
  process.title = 'wpe-daemon'
  function daemonManager(data: Buffer) {
    const message: message = JSON.parse(data.toString())
    switch (message.action) {
      case ACTIONS.STOP_DAEMON:
        notify('Exiting daemon')
        Playlist.stop()
        daemonServer.close()
        process.exit(0)
      case ACTIONS.UPDATE_CONFIG:
        configuration.app.update()
        configuration.swww.update()
        break
      case ACTIONS.START_PLAYLIST:
        Playlist.start()
        notify(`Starting ${Playlist.currentName}`)
        break
    }
    if (Playlist.currentName !== '') {
      switch (message.action) {
        case ACTIONS.UPDATE_PLAYLIST:

        case ACTIONS.PAUSE_PLAYLIST:
          Playlist.pause()
          notify(`Pausing ${Playlist.currentName}`)
          break
        case ACTIONS.RESUME_PLAYLIST:
          Playlist.resume()
          notify(`Resuming ${Playlist.currentName}`)
          break
        case ACTIONS.STOP_PLAYLIST:
          notify(`Stopping ${Playlist.currentName}`)
          Playlist.stop()
          break
        case ACTIONS.NEXT_IMAGE:
          Playlist.nextImage()
          break
        case ACTIONS.PREVIOUS_IMAGE:
          Playlist.previousImage()
          break
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
    console.log('Exiting daemon...')
    Playlist.stop()
    daemonServer.close()
    process.exit(0)
  })
  process.on('SIGINT', () => {
    notify('Exiting daemon')
    console.log('Exiting daemon...')
    Playlist.stop()
    daemonServer.close()
    process.exit(0)
  })
  Playlist.start()
}
daemonInit()
