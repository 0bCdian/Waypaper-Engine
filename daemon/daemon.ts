import { createServer } from 'node:net'
import { unlinkSync } from 'node:fs'
import { execSync, exec } from 'node:child_process'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { message, PLAYLIST_TYPES, images, ACTIONS } from './typesDaemon'
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
  process.title = 'wpe-daemon'
  isSwwwDaemonRunning()
}

const IMAGES_DIR = join(homedir(), '.waypaper_engine', 'images')
const SOCKET_PATH = '/tmp/waypaper_engine_daemon.sock'

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


class Playlist {
  images: images
  currentName: string
  currentType: PLAYLIST_TYPES | undefined
  intervalID: NodeJS.Timeout | undefined
  timeoutID: NodeJS.Timeout | undefined
  currentImageIndex: number
  interval: number | null
  showAnimations: boolean | 1 | 0
  constructor() {
    this.images = []
    this.currentName = ''
    this.currentType = undefined
    this.currentType = undefined
    this.currentImageIndex = 0
    this.interval = 0
    this.showAnimations = true
    this.intervalID = undefined
    this.timeoutID = undefined
  }
  setImage(imageName: string) {
    const command = this.getSwwwCommandFromConfiguration(
      join(IMAGES_DIR, imageName)
    )
    if (command) {
      notifyImageSet(imageName, join(IMAGES_DIR, imageName))
      execSync(command)
    }
  }
  pause() {
    clearInterval(this.intervalID)
    clearTimeout(this.timeoutID)
    this.intervalID = undefined
    this.timeoutID = undefined
  }
  resume() {
    if (this.currentType === PLAYLIST_TYPES.TIMER) {
      this.timedPlaylist(true)
    }
  }
  stop() {
    this.pause()
    this.currentImageIndex = 0
    this.currentName = ''
    this.currentType = undefined
    this.interval = 0
    this.images = []
    this.showAnimations = true
  }
  resetInterval() {
    clearInterval(this.intervalID)
    this.intervalID = undefined
    this.timedPlaylist()
  }
  nextImage() {
    this.currentImageIndex++
    if (this.currentImageIndex === this.images.length) {
      this.currentImageIndex = 0
    }
    if (this.currentType === PLAYLIST_TYPES.TIMER) {
      this.resetInterval()
    } else {
      this.setImage(this.images[this.currentImageIndex].name)
    }
    this.updateInDB()
  }
  previousImage() {
    this.currentImageIndex--
    if (this.currentImageIndex < 0) {
      this.currentImageIndex = this.images.length - 1
    }
    if (this.currentType === PLAYLIST_TYPES.TIMER) {
      this.resetInterval()
    } else {
      this.setImage(this.images[this.currentImageIndex].name)
    }
    this.updateInDB()
  }
  start() {
    const shouldNotStart = this.setPlaylist()
    if (!shouldNotStart) {
      switch (this.currentType) {
        case PLAYLIST_TYPES.TIMER:
          this.timedPlaylist()
          break
        case PLAYLIST_TYPES.NEVER:
          this.neverPlaylist()
          break
        case PLAYLIST_TYPES.TIME_OF_DAY:
          this.timeOfDayPlaylist()
          break
        case PLAYLIST_TYPES.DAY_OF_WEEK:
          this.dayOfWeekPlaylist()
          break
        default:
          this.stop()
          return
      }
    }
  }
  updateInDB() {
    try {
      dbOperations.updatePlaylistCurrentIndex(
        this.currentImageIndex,
        this.currentName
      )
    } catch (error) {
      console.error(error)
      notify(
        'Could not update playlist in DB, restart the app to restore the database'
      )
      notify('Exiting daemon')
      throw new Error('Could not update playlist in DB')
    }
  }
  setPlaylist() {
    try {
      const currentPlaylist = dbOperations.getCurrentPlaylist()
      if (currentPlaylist === null) {
        return false
      }
      const areTheSame = this.comparePlaylists(currentPlaylist)
      if (!areTheSame) {
        this.stop()
      }
      this.images = currentPlaylist.images
      this.currentName = currentPlaylist.name
      this.currentType = currentPlaylist.type
      this.currentImageIndex = configuration.app.settings
        .playlistStartOnFirstImage
        ? 0
        : currentPlaylist.currentImageIndex
      this.interval = currentPlaylist.interval
      this.showAnimations = currentPlaylist.showAnimations
      return areTheSame
    } catch (error) {
      console.error(error)
      throw new Error('Could not set playlist')
    }
  }
  timedPlaylist(resume?: boolean) {
    if (this.interval !== null) {
      if (!resume) {
        this.setImage(this.images[this.currentImageIndex].name)
      }
      this.intervalID = setInterval(() => {
        this.currentImageIndex++
        if (this.currentImageIndex === this.images.length) {
          this.currentImageIndex = 0
        }
        this.setImage(this.images[this.currentImageIndex].name)
        this.updateInDB()
      }, this.interval)
    } else {
      console.error('Interval is null')
      notify('Interval is null, something went wrong setting the playlist')
    }
  }
  neverPlaylist() {
    this.setImage(this.images[this.currentImageIndex].name)
  }
  timeOfDayPlaylist() {
    const startingIndex = this.findImageIndexRelativeToNow()
    if (startingIndex === undefined) {
      throw new Error('Images have no time, something went wrong')
    } else {
      this.currentImageIndex = startingIndex
      this.timeOfDayPlayer()
    }
  }
  dayOfWeekPlaylist() {
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
    this.setImage(this.images[now.getDay()].name)
    this.intervalID = setTimeout(() => {
      this.dayOfWeekPlaylist()
    }, millisecondsUntilEndOfDay)
  }
  getSwwwCommandFromConfiguration(imagePath: string, monitors?: string[]) {
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
      if (!configuration.app.settings.swwwAnimations || !this.showAnimations) {
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
  comparePlaylists(newPlaylist: newPlaylist) {
    if (
      !newPlaylist ||
      this.currentName !== newPlaylist.name ||
      this.currentType !== newPlaylist.type ||
      this.interval !== newPlaylist.interval ||
      newPlaylist.type === PLAYLIST_TYPES.TIME_OF_DAY
    ) {
      return false
    } else {
      return true
    }
  }
  timeOfDayPlayer() {
    const { time: timeOut, shouldSetRightAway } =
      this.calculateMillisecondsUntilNextImage()
    if (shouldSetRightAway) {
      this.setImage(this.images[this.currentImageIndex].name)
    }
    this.timeoutID = setTimeout(() => {
      this.setImage(this.images[this.currentImageIndex].name)
      let newIndex = this.currentImageIndex + 1
      if (newIndex === this.images.length) {
        newIndex = 0
      }
      this.currentImageIndex = newIndex
      this.timeOfDayPlayer()
    }, timeOut)
  }
  calculateMillisecondsUntilNextImage() {
    let nextIndex =
      this.currentImageIndex + 1 === this.images.length
        ? 0
        : this.currentImageIndex + 1
    const nextTime = this.images[nextIndex].time
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
  findImageIndexRelativeToNow() {
    const date = new Date()
    const nowTime = date.getHours() * 60 + date.getMinutes()
    let lowestPoint = 0
    let highestPoint = this.images.length
    let closestIndex: number = highestPoint - 1
    do {
      const midPoint = Math.floor(
        lowestPoint + (highestPoint - lowestPoint) / 2
      )
      const currentTimeStamp = this.images[midPoint].time
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
}

function daemonInit() {
  const playlistController = new Playlist()
  function daemonManager(data: Buffer) {
    const message: message = JSON.parse(data.toString())
    switch (message.action) {
      case ACTIONS.STOP_DAEMON:
        notify('Exiting daemon')
        playlistController.stop()
        daemonServer.close()
        process.exit(0)
      case ACTIONS.UPDATE_CONFIG:
        configuration.app.update()
        configuration.swww.update()
        break
      case ACTIONS.START_PLAYLIST:
        playlistController.start()
        notify(`Starting ${playlistController.currentName}`)
        break
    }
    if (playlistController.currentName !== '') {
      switch (message.action) {
        case ACTIONS.UPDATE_PLAYLIST:

        case ACTIONS.PAUSE_PLAYLIST:
          playlistController.pause()
          notify(`Pausing ${playlistController.currentName}`)
          break
        case ACTIONS.RESUME_PLAYLIST:
          playlistController.resume()
          notify(`Resuming ${playlistController.currentName}`)
          break
        case ACTIONS.STOP_PLAYLIST:
          notify(`Stopping ${playlistController.currentName}`)
          playlistController.stop()
          break
        case ACTIONS.NEXT_IMAGE:
          playlistController.nextImage()
          break
        case ACTIONS.PREVIOUS_IMAGE:
          playlistController.previousImage()
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
    playlistController.stop()
    daemonServer.close()
    process.exit(0)
  })
  process.on('SIGINT', () => {
    notify('Exiting daemon')
    console.log('Exiting daemon...')
    playlistController.stop()
    daemonServer.close()
    process.exit(0)
  })
  playlistController.start()
}
daemonInit()
