const Database = require('better-sqlite3')
import { dbTables, PlaylistDB, imageInPlaylist } from './typesDaemon'
const db = Database('/home/obsy/dev/electron-vite-project/waypaper.sqlite3', {
  verbose: console.log
})

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

export function updatePlaylistCurrentIndex(imageIndex: number, playlistName: string) {
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