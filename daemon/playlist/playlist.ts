import {
  ACTIONS,
  images,
  PLAYLIST_TYPES,
  PlaylistType,
} from '../types/daemonTypes'
import configuration from '../config/config'
import { notify, notifyImageSet } from '../utils/notifications'
import { join } from 'node:path'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import dbOperations from '../database/dbOperationsDaemon'
const execPromisified = promisify(exec)
export class Playlist {
  images: images
  currentName: string
  currentType: PLAYLIST_TYPES | undefined
  playlistTimer: {
    timeoutID: NodeJS.Timeout | undefined
    executionTimeStamp: number | undefined
  }
  eventCheckerTimeout: NodeJS.Timeout | undefined
  currentImageIndex: number
  interval: number | null
  showAnimations: boolean | 1 | 0
  constructor() {
    this.images = []
    this.currentName = ''
    this.currentType = undefined
    this.currentImageIndex = 0
    this.interval = 0
    this.showAnimations = true
    this.playlistTimer = {
      timeoutID: undefined,
      executionTimeStamp: undefined,
    }
    this.eventCheckerTimeout = undefined
  }

  async setImage(imageName: string) {
    try {
      const imageLocation = join(configuration.IMAGES_DIR, imageName)
      const command = this.getSwwwCommandFromConfiguration(imageLocation)
      notifyImageSet(imageName, imageLocation)
      await execPromisified(command)
      if (configuration.script !== undefined) {
        await execPromisified(`${configuration.script} ${imageLocation}`)
      }
    } catch (error) {
      notify(error)
    }
  }

  pause() {
    if (this.currentType === PLAYLIST_TYPES.TIMER) {
      clearTimeout(this.playlistTimer.timeoutID)
      this.playlistTimer.timeoutID = undefined
      return `Paused ${this.currentName}`
    } else {
      return `Cannot pause ${this.currentName} because it's of type ${this.currentType}`
    }
  }
  resume() {
    if (this.currentType === PLAYLIST_TYPES.TIMER) {
      this.timedPlaylist(true)
      return `Resuming ${this.currentName}`
    } else {
      return `Cannot resume ${this.currentName} because it is of type ${this.currentType}`
    }
  }
  stop(setToNull: boolean) {
    if (setToNull) {
      dbOperations.setActivePlaylistToNull()
    }
    const playlist_name = this.currentName
    this.pause()
    this.currentImageIndex = 0
    this.currentName = ''
    this.currentType = undefined
    this.interval = 0
    this.images = []
    this.showAnimations = true
    if (this.eventCheckerTimeout !== undefined) {
      clearInterval(this.eventCheckerTimeout)
    }
    if (this.playlistTimer.timeoutID !== undefined) {
      clearTimeout(this.playlistTimer.timeoutID)
    }
    this.playlistTimer.timeoutID = undefined
    this.playlistTimer.executionTimeStamp = undefined
    this.eventCheckerTimeout = undefined

    if (playlist_name === '') {
      return {
        action: ACTIONS.STOP_PLAYLIST,
        message: '',
      }
    }
    return {
      action: ACTIONS.STOP_PLAYLIST,
      message: `Stopped ${playlist_name}`,
    }
  }
  resetInterval() {
    clearTimeout(this.playlistTimer.timeoutID)
    this.playlistTimer.timeoutID = undefined
    this.timedPlaylist(true)
  }
  async nextImage() {
    if (
      this.currentType === PLAYLIST_TYPES.DAY_OF_WEEK ||
      this.currentType === PLAYLIST_TYPES.TIME_OF_DAY ||
      undefined
    ) {
      notify('Cannot change image in this type of playlist')
      return 'Cannot change image in this type of playlist'
    }
    this.currentImageIndex++
    if (this.currentImageIndex === this.images.length) {
      this.currentImageIndex = 0
    }
    if (this.currentType === PLAYLIST_TYPES.TIMER) {
      this.resetInterval()
    }
    await this.setImage(this.images[this.currentImageIndex].name)
    try {
      this.updateInDB()
    } catch (error) {
      notify(`Could not connect to the database\n Error:\n${error}`)
      throw error
    }
    return `Setting:${this.images[this.currentImageIndex].name}`
  }
  async previousImage() {
    if (
      this.currentType === PLAYLIST_TYPES.DAY_OF_WEEK ||
      this.currentType === PLAYLIST_TYPES.TIME_OF_DAY ||
      undefined
    ) {
      notify('Cannot change image in this type of playlist')
      return 'Cannot change image in this type of playlist'
    }
    this.currentImageIndex--
    if (this.currentImageIndex < 0) {
      this.currentImageIndex = this.images.length - 1
    }
    if (this.currentType === PLAYLIST_TYPES.TIMER) {
      this.resetInterval()
    }
    await this.setImage(this.images[this.currentImageIndex].name)
    try {
      this.updateInDB()
    } catch (error) {
      notify(`Could not connect to the database\n Error:\n${error}`)
      throw error
    }
    return `Setting:${this.images[this.currentImageIndex].name}`
  }
  start() {
    try {
      const currentPlaylist = dbOperations.getCurrentPlaylist()
      if (currentPlaylist === undefined) {
        return {
          action: ACTIONS.ERROR,
          message: 'Database returned undefined from currentPlaylist',
        }
      }
      this.stop(false)
      this.setPlaylist(currentPlaylist)
      switch (this.currentType) {
        case PLAYLIST_TYPES.TIMER:
          this.timedPlaylist()
          break
        case PLAYLIST_TYPES.NEVER:
          this.neverPlaylist()
          break
        case PLAYLIST_TYPES.TIME_OF_DAY:
          this.timeOfDayPlaylist().then(() => {
            this.checkMissedEvents()
          })
          break
        case PLAYLIST_TYPES.DAY_OF_WEEK:
          this.dayOfWeekPlaylist().then(() => this.checkMissedEvents())
          break
        default:
          this.stop(true)
          break
      }
      return {
        action: ACTIONS.START_PLAYLIST,
        message: `Started playlist ${currentPlaylist.name}`,
      }
    } catch (error) {
      notify(`Could not connect to the database\n Error:\n${error}`)
      throw error
    }
  }
  updatePlaylist() {
    try {
      const newPlaylistInfo = dbOperations.getCurrentPlaylist()
      if (
        newPlaylistInfo !== undefined &&
        newPlaylistInfo.name === this.currentName
      ) {
        switch (this.currentType) {
          case PLAYLIST_TYPES.TIMER:
            if (newPlaylistInfo.interval !== this.interval) {
              this.stop(false)
            }
            this.setPlaylist(newPlaylistInfo)
            break
          case PLAYLIST_TYPES.NEVER:
            this.images = newPlaylistInfo.images
            this.showAnimations = newPlaylistInfo.showAnimations
            break
          case PLAYLIST_TYPES.TIME_OF_DAY:
            this.stop(false)
            this.setPlaylist(newPlaylistInfo)
            this.timeOfDayPlaylist().then(() => {
              this.checkMissedEvents()
            })
            break
          case PLAYLIST_TYPES.DAY_OF_WEEK:
            this.stop(false)
            this.setPlaylist(newPlaylistInfo)
            this.dayOfWeekPlaylist().then(() => {
              this.checkMissedEvents()
            })
            break
          default:
            this.stop(true)
            break
        }
        return {
          action: ACTIONS.UPDATE_PLAYLIST,
          message: `Updated ${newPlaylistInfo.name}`,
        }
      } else {
        notify(
          'There was a problem updating the playlist, either the names do not match, or the database returned null',
        )
        return {
          action: ACTIONS.ERROR,
          message:
            'There was a problem updating the playlist, either the names do not match, or the database returned null',
        }
      }
    } catch (error) {
      notify(`Could not connect to the database\n Error:\n${error}`)
      throw error
    }
  }
  updateInDB() {
    try {
      dbOperations.updatePlaylistCurrentIndex(
        this.currentImageIndex,
        this.currentName,
      )
    } catch (error) {
      notify(`Could not connect to the database\n Error:\n${error}`)
      throw error
    }
  }
  setPlaylist(currentPlaylist: PlaylistType) {
    this.images = currentPlaylist.images
    this.currentName = currentPlaylist.name
    this.currentType = currentPlaylist.type
    this.currentImageIndex = configuration.app.settings
      .playlistStartOnFirstImage
      ? 0
      : currentPlaylist.currentImageIndex
    this.interval = currentPlaylist.interval
    this.showAnimations = currentPlaylist.showAnimations
  }
  async timedPlaylist(resume?: boolean) {
    if (this.interval !== null) {
      if (!resume) {
        await this.setImage(this.images[this.currentImageIndex].name)
      }
      this.playlistTimer.timeoutID = setInterval(async () => {
        this.currentImageIndex++
        if (this.currentImageIndex === this.images.length) {
          this.currentImageIndex = 0
        }
        await this.setImage(this.images[this.currentImageIndex].name)
        this.updateInDB()
      }, this.interval)
    } else {
      console.error('Interval is null')
      notify('Interval is null, something went wrong setting the playlist')
    }
  }
  async neverPlaylist() {
    await this.setImage(this.images[this.currentImageIndex].name)
  }
  async timeOfDayPlaylist() {
    try {
      const startingIndex = this.findClosestImageIndex()
      if (startingIndex === undefined) {
        notify('Images have no time, something went wrong')
        this.stop(true)
        return
      }
      this.currentImageIndex =
        startingIndex < 0 ? this.images.length - 1 : startingIndex
      await this.setImage(this.images[this.currentImageIndex].name)
      this.timeOfDayPlayer()
    } catch (error) {
      notify(`Could not connect to the database\n Error:\n${error}`)
      throw error
    }
  }
  async dayOfWeekPlaylist() {
    const now = new Date()
    const endOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0,
      0,
      0,
    )
    const millisecondsUntilEndOfDay = endOfDay.getTime() - now.getTime()
    let imageIndexToSet = now.getDay()
    if (imageIndexToSet > this.images.length) {
      imageIndexToSet = this.images.length - 1
    }
    await this.setImage(this.images[imageIndexToSet].name)
    clearTimeout(this.playlistTimer.timeoutID)
    this.playlistTimer.timeoutID = setTimeout(() => {
      this.dayOfWeekPlaylist()
    }, millisecondsUntilEndOfDay)
    this.playlistTimer.executionTimeStamp =
      millisecondsUntilEndOfDay + Date.now()
  }
  getSwwwCommandFromConfiguration(imagePath: string) {
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

    const baseCommand = `swww img "${imagePath}" --resize="${swwwConfig.resizeType}" --fill-color "${swwwConfig.fillColor}" --filter ${swwwConfig.filterType} --transition-step ${swwwConfig.transitionStep} --transition-duration ${swwwConfig.transitionDuration} --transition-fps ${swwwConfig.transitionFPS} --transition-angle ${swwwConfig.transitionAngle} --transition-pos ${transitionPos} ${inverty} --transition-bezier ${swwwConfig.transitionBezier} --transition-wave "${swwwConfig.transitionWaveX},${swwwConfig.transitionWaveY}"`
    if (!configuration.app.settings.swwwAnimations || !this.showAnimations) {
      const command = baseCommand.concat(' --transition-type=none')
      return command
    } else {
      const command = baseCommand.concat(
        ` --transition-type=${swwwConfig.transitionType}`,
      )
      return command
    }
  }
  timeOfDayPlayer() {
    const timeOut = this.calculateMillisecondsUntilNextImage()
    if (timeOut === undefined) {
      notify(`Stopping playlist ${this.currentName}`)
      this.stop(true)
      return
    }
    clearTimeout(this.playlistTimer.timeoutID)
    this.playlistTimer.timeoutID = setTimeout(async () => {
      let newIndex = this.currentImageIndex + 1
      if (newIndex === this.images.length) {
        newIndex = 0
      }
      this.currentImageIndex = newIndex
      await this.setImage(this.images[this.currentImageIndex].name)
      this.timeOfDayPlayer()
    }, timeOut)
    this.playlistTimer.executionTimeStamp = timeOut + Date.now()
  }

  calculateMillisecondsUntilNextImage() {
    let nextIndex =
      this.currentImageIndex + 1 === this.images.length
        ? 0
        : this.currentImageIndex + 1
    const nextTime = this.images[nextIndex].time
    if (nextTime === null) return undefined
    const date = new Date()
    const nowInMinutes = date.getHours() * 60 + date.getMinutes()
    let time = nextTime - nowInMinutes
    if (time < 0) {
      time += 1440
    }
    time = 60 * time
    time = time - date.getSeconds()
    time = time * 1000
    return time
  }
  findClosestImageIndex() {
    const date = new Date()
    const currentTime = date.getHours() * 60 + date.getMinutes()
    let low = 0
    let high = this.images.length - 1
    let closestIndex = -1

    while (low <= high) {
      const mid = Math.floor((low + high) / 2)
      const midTime = this.images[mid].time
      if (midTime === null) return undefined
      if (midTime === currentTime) {
        return mid
      } else if (midTime < currentTime) {
        closestIndex = mid
        low = mid + 1
      } else {
        high = mid - 1
      }
    }
    return closestIndex
  }

  async setRandomImage() {
    try {
      const images = dbOperations.readAllImagesInDB()
      if (images === undefined) {
        return 'There are no images in the database'
      }
      const randomIndex = Math.floor(Math.random() * images.length)
      const randomImage = images[randomIndex].name
      await this.setImage(randomImage)
      return `Setting ${randomImage}`
    } catch (error) {
      notify(error)
      throw error
    }
  }

  async checkMissedEvents() {
    clearTimeout(this.eventCheckerTimeout)
    this.eventCheckerTimeout = setInterval(() => {
      const now = Date.now()
      if (
        this.playlistTimer.executionTimeStamp === undefined ||
        now < this.playlistTimer.executionTimeStamp ||
        this.playlistTimer.timeoutID === undefined ||
        this.currentType === undefined
      ) {
        return
      }
      clearTimeout(this.playlistTimer.timeoutID)
      switch (this.currentType) {
        case PLAYLIST_TYPES.TIME_OF_DAY:
          this.timeOfDayPlaylist()
          break
        case PLAYLIST_TYPES.DAY_OF_WEEK:
          this.dayOfWeekPlaylist()
          break
      }
    }, 10_000)
  }

  async getPlaylistDiagnostics() {
    const diagostics = {
      playlistName: this.currentName,
      playlistType: this.currentType,
      playlistCurrentIndex: this.currentImageIndex,
      playlistEventCheckerTimeout: {
        id: String(this.eventCheckerTimeout),
      },
      playlistTimerObject: {
        timeoutID: String(this.playlistTimer.timeoutID),
        executionTimeStamp: new Date(
          this.playlistTimer.executionTimeStamp ?? 0,
        ),
      },
      playlistImages: this.images.map((image) => {
        return JSON.stringify(image)
      }),
      playlistInterval: this.interval,
      daemonPID: process.pid,
    }
    return diagostics
  }
}

export type PlaylistClass = InstanceType<typeof Playlist>
