import {
  ACTIONS,
  images,
  PLAYLIST_TYPES,
  PlaylistType
} from '../types/daemonTypes'
import configuration from '../config/config'
import { notify, notifyImageSet } from '../utils/notifications'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import dbOperations from '../database/dbOperationsDaemon'

export class Playlist {
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
    this.currentImageIndex = 0
    this.interval = 0
    this.showAnimations = true
    this.intervalID = undefined
    this.timeoutID = undefined
  }

  setImage(imageName: string) {
    const imageLocation = join(configuration.IMAGES_DIR, imageName)
    const command = this.getSwwwCommandFromConfiguration(imageLocation)
    if (command) {
      notifyImageSet(imageName, imageLocation)
      execSync(command)
    }
  }
  pause() {
    if (this.currentType === PLAYLIST_TYPES.TIMER) {
      clearInterval(this.intervalID)
      clearTimeout(this.timeoutID)
      this.intervalID = undefined
      this.timeoutID = undefined
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

    if (playlist_name === '') {
      return {
        action: ACTIONS.STOP_PLAYLIST,
        message: ''
      }
    }
    return {
      action: ACTIONS.STOP_PLAYLIST,
      message: `Stopped ${playlist_name}`
    }
  }
  resetInterval() {
    clearInterval(this.intervalID)
    this.intervalID = undefined
    this.timedPlaylist(true)
  }
  nextImage() {
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
    this.setImage(this.images[this.currentImageIndex].name)
    try {
      this.updateInDB()
    } catch (error) {
      notify(`Could not connect to the database\n Error:\n${error}`)
      process.exit(1)
    }
    return `Setting:${this.images[this.currentImageIndex].name}`
  }
  previousImage() {
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
    this.setImage(this.images[this.currentImageIndex].name)
    try {
      this.updateInDB()
    } catch (error) {
      notify(`Could not connect to the database\n Error:\n${error}`)
      process.exit(1)
    }
    return `Setting:${this.images[this.currentImageIndex].name}`
  }
  start() {
    try {
      const currentPlaylist = dbOperations.getCurrentPlaylist()
      if (currentPlaylist === undefined) {
        return {
          action: ACTIONS.ERROR,
          message: 'Database returned undefined from currentPlaylist'
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
          this.timeOfDayPlaylist()
          break
        case PLAYLIST_TYPES.DAY_OF_WEEK:
          this.dayOfWeekPlaylist()
          break
        default:
          this.stop(true)
          break
      }
      return {
        action: ACTIONS.START_PLAYLIST,
        message: `Started playlist ${currentPlaylist.name}`
      }
    } catch (error) {
      notify(`Could not connect to the database\n Error:\n${error}`)
      process.exit(1)
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
            this.timeOfDayPlaylist()
            break
          case PLAYLIST_TYPES.DAY_OF_WEEK:
            this.stop(false)
            this.setPlaylist(newPlaylistInfo)
            this.dayOfWeekPlaylist()
            break
          default:
            this.stop(true)
            break
        }
        return {
          action: ACTIONS.UPDATE_PLAYLIST,
          message: `Updated ${newPlaylistInfo.name}`
        }
      } else {
        notify(
          'There was a problem updating the playlist, either the names do not match, or the database returned null'
        )
        return {
          action: ACTIONS.ERROR,
          message:
            'There was a problem updating the playlist, either the names do not match, or the database returned null'
        }
      }
    } catch (error) {
      notify(`Could not connect to the database\n Error:\n${error}`)
      process.exit(1)
    }
  }
  updateInDB() {
    try {
      dbOperations.updatePlaylistCurrentIndex(
        this.currentImageIndex,
        this.currentName
      )
    } catch (error) {
      notify(`Could not connect to the database\n Error:\n${error}`)
      process.exit(1)
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
    try {
      const startingIndex = this.findClosestImageIndex()
      if (startingIndex === undefined) {
        notify('Images have no time, something went wrong')
        this.stop(true)
        return
      }
      this.currentImageIndex = startingIndex
      this.setImage(this.images[this.currentImageIndex].name)
      this.timeOfDayPlayer()
    } catch (error) {
      notify(`Could not connect to the database\n Error:\n${error}`)
      process.exit(1)
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
  timeOfDayPlayer() {
    const timeOut = this.calculateMillisecondsUntilNextImage()
    if (timeOut === undefined) {
      notify(`Stopping playlist ${this.currentName}`)
      this.stop(true)
      return
    }
    this.timeoutID = setTimeout(() => {
      let newIndex = this.currentImageIndex + 1
      if (newIndex === this.images.length) {
        newIndex = 0
      }
      this.currentImageIndex = newIndex
      this.setImage(this.images[this.currentImageIndex].name)
      this.timeOfDayPlayer()
    }, timeOut)
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
        return mid // Found an exact match
      } else if (midTime < currentTime) {
        closestIndex = mid // Update the closest index
        low = mid + 1 // Move to the right half
      } else {
        high = mid - 1 // Move to the left half
      }
    }
    return closestIndex
  }

  setRandomImage() {
    try {
      const images = dbOperations.readAllImagesInDB()
      if (images === undefined) {
        return 'There are no images in the database'
      }
      const randomIndex = Math.floor(Math.random() * images.length)
      const randomImage = images[randomIndex].name
      this.setImage(randomImage)
      return `Setting ${randomImage}`
    } catch (error) {
      notify(error)
      process.exit(1)
    }
  }
}

export type PlaylistClass = InstanceType<typeof Playlist>
