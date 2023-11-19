import Database from 'better-sqlite3'
import {
  dbTables,
  PlaylistDB,
  images,
  imageInPlaylist,
  initialAppConfig,
  swwwConfig,
  PLAYLIST_TYPES,
  ORDER_TYPES
} from './typesDaemon'
import { homedir } from 'node:os'
import { join } from 'node:path'

const dbOperations = {
  connection: Database(
    join(homedir(), '.waypaper_engine', 'images_database.sqlite3'),
    { fileMustExist: true, timeout: 10000 }
  ),
  getImagesInPlaylist: function (playlistID: number) {
    try {
      const selectImagesInPlaylist = this.connection.prepare(
        `SELECT * FROM ${dbTables.imagesInPlaylist} WHERE playlistId = ? ORDER BY indexInPlaylist ASC`
      )
      const imagesInPlaylist = selectImagesInPlaylist.all(
        playlistID
      ) as imageInPlaylist[]
      let imagesArray: { name: string; time: number | null }[] = []
      for (let current = 0; current < imagesInPlaylist.length; current++) {
        const currentName = dbOperations.getImageNameFromID(
          imagesInPlaylist[current].imageID
        )
        if (currentName !== null) {
          imagesArray.push({
            name: currentName,
            time: imagesInPlaylist[current].time
          })
        }
      }
      return imagesArray
    } catch (error) {
      console.error(error)
      return []
    }
  },
  getNewImagesInPlaylist(playlistID: number) {
    try {
      const selectImagesInPlaylist = this.connection.prepare(
        `SELECT name,time FROM imagesInPlaylist INNER JOIN Images ON imagesInPlaylist.imageID = Images.id AND imagesInPlaylist.playlistID = ? ORDER BY indexInPlaylist ASC`
      )
      const imagesInPlaylist = selectImagesInPlaylist.all(
        playlistID
      ) as imageInPlaylist[]
      return imagesInPlaylist
    } catch (error) {
      console.error(error)
      return [] as imageInPlaylist[]
    }
  },
  getImageNameFromID: function (imageID: number) {
    try {
      const selectImage = this.connection.prepare(
        `SELECT name FROM ${dbTables.Images} WHERE id = ?`
      )
      const image = selectImage.get(imageID)
      return image.name as string
    } catch (error) {
      console.error(error)
      return null
    }
  },
  updatePlaylistCurrentIndex: function (
    imageIndex: number,
    playlistName: string
  ) {
    try {
      const updatePlaylist = this.connection.prepare(
        `UPDATE ${dbTables.Playlists} SET currentImageIndex = ? WHERE name = ?`
      )
      updatePlaylist.run(imageIndex, playlistName)
    } catch (error) {
      console.error(error)
      throw new Error('Could not update playlist in DB')
    }
  },
  readAppConfig: function () {
    try {
      const [getConfig] = this.connection
        .prepare(`SELECT * FROM ${dbTables.appConfig}`)
        .all()
      return getConfig as initialAppConfig
    } catch (error) {
      console.error(error)
      throw new Error('Could not read app configuration from the database')
    }
  },
  readSwwwConfig: function () {
    try {
      const [swwwConfigObject] = this.connection
        .prepare(`SELECT * FROM ${dbTables.swwwConfig}`)
        .all()
      return swwwConfigObject as swwwConfig
    } catch (error) {
      console.error(error)
      throw new Error('Could not read swwwConfig from the database')
    }
  },
  readCurrentPlaylistID: function () {
    return this.connection
      .prepare(`SELECT * FROM ${dbTables.activePlaylist}`)
      .all() as [{ playlistID: number }] | []
  },
  getCurrentPlaylist: function (): {
    images: images
    id: number
    name: string
    type: PLAYLIST_TYPES
    interval: number | null
    order: ORDER_TYPES | null
    showAnimations: boolean | 0 | 1
    currentImageIndex: number
  } | null {
    const [result] = this.readCurrentPlaylistID()
    if (result) {
      const [playlist] = this.connection
        .prepare(`SELECT * FROM ${dbTables.Playlists} WHERE id=?`)
        .all(result.playlistID) as [PlaylistDB | undefined]
      if (playlist) {
        return {
          ...playlist,
          images: dbOperations.getImagesInPlaylist(playlist.id)
        }
      } else {
        return null
      }
    } else {
      return null
    }
  }
}

export default dbOperations
