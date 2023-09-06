const Database = require('better-sqlite3')
import { dbTables, PlaylistDB, imageInPlaylist, initialAppConfig, swwwConfig } from './typesDaemon'
import { homedir } from 'node:os'
import { join } from 'node:path'

const db = Database(
  join(homedir(), '.waypaper_engine', 'images_database.sqlite3'),
  {
    verbose: console.log
  }
)

export function getPlaylistFromDB(playlistName: string) {
  try {
    const selectPlaylist = db.prepare(
      `SELECT * FROM ${dbTables.Playlists} WHERE name = ?`
    )
    const playlist = selectPlaylist.get(playlistName) as PlaylistDB
    return { ...playlist, images: getImagesInPlaylist(playlist.id) }
  } catch (error) {
    console.error(error)
    return null
  }
}

export function getImagesInPlaylist(playlistID: number) {
  try {
    const selectImagesInPlaylist = db.prepare(
      `SELECT * FROM ${dbTables.imagesInPlaylist} WHERE playlistId = ? ORDER BY indexInPlaylist ASC`
    )
    const imagesInPlaylist = selectImagesInPlaylist.all(
      playlistID
    ) as imageInPlaylist[]
    const imagesArray = imagesInPlaylist
      .map((image) => {
        return getImageNameFromID(image.imageID)
      })
      .filter((image) => image !== null) as string[]
    return imagesArray
  } catch (error) {
    console.error(error)
    return [] as string[]
  }
}

function getImageNameFromID(imageID: number) {
  try {
    const selectImage = db.prepare(
      `SELECT name FROM ${dbTables.Images} WHERE id = ?`
    )
    const image = selectImage.get(imageID)
    return image.name as string
  } catch (error) {
    console.error(error)
    return null
  }
}

export function updatePlaylistCurrentIndex(
  imageIndex: number,
  playlistName: string
) {
  try {
    const updatePlaylist = db.prepare(
      `UPDATE ${dbTables.Playlists} SET currentImageIndex = ? WHERE name = ?`
    )
    updatePlaylist.run(imageIndex, playlistName)
  } catch (error) {
    console.error(error)
    throw new Error('Could not update playlist in DB')
  }
}

export function readAppConfig() {
  try {
    const [getConfig] = db.prepare(`SELECT * FROM ${dbTables.appConfig}`).all()
    return getConfig as initialAppConfig
  } catch (error) {
    console.error(error)
    throw new Error('Could not read app configuration from the database')
  }
}
export function readSwwwConfig() {
  try {
    const [swwwConfigObject] = db
      .prepare(`SELECT * FROM ${dbTables.swwwConfig}`)
      .all()
    return swwwConfigObject as swwwConfig
  } catch (error) {
    console.error(error)
    throw new Error('Could not read swwwConfig from the database')
  }
}