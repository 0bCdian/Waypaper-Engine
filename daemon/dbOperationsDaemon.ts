const Database = require('better-sqlite3')
import {
  dbTables,
  PlaylistDB,
  imageInPlaylist,
  initialAppConfig,
  swwwConfig
} from './typesDaemon'
import { homedir } from 'node:os'
import { join } from 'node:path'

const dbOperations = {
  connection: Database(
    join(homedir(), '.waypaper_engine', 'images_database.sqlite3'),
    {
      verbose: console.log
    }
  ),
  getImagesInPlaylist: function (playlistID: number) {
    try {
      const selectImagesInPlaylist = this.connection.prepare(
        `SELECT * FROM ${dbTables.imagesInPlaylist} WHERE playlistId = ? ORDER BY indexInPlaylist ASC`
      )
      const imagesInPlaylist = selectImagesInPlaylist.all(
        playlistID
      ) as imageInPlaylist[]
      const imagesArray = imagesInPlaylist
        .map((image) => {
          return this.getImageNameFromID(image.imageID)
        })
        .filter((image) => image !== null) as string[]
      return imagesArray
    } catch (error) {
      console.error(error)
      return [] as string[]
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
  getCurrentPlaylist: function () {
    const [result] = this.readCurrentPlaylistID()
    if (result) {
      const [playlist] = this.connection
        .prepare(`SELECT * FROM ${dbTables.Playlists} WHERE id=?`)
        .all(result.playlistID) as [PlaylistDB]
      return { ...playlist, images: this.getImagesInPlaylist(playlist.id) }
    } else {
      return null
    }
  }
}

export default dbOperations
