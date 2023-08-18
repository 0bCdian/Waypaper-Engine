import db from './db'
import { dbTables, Image, Playlist, imageInPlaylist } from '../types/types'
import {
  rendererPlaylist,
  Image as rendererImage
} from '../../src/types/rendererTypes'

export function testDB() {
  const test = db.prepare(
    `SELECT * FROM ${dbTables.Images},${dbTables.Playlists},${dbTables.imagesInPlaylist}`
  )
  try {
    test.run()
  } catch (error) {
    console.error(error)
    throw new Error('Could not comunicate with the database')
  }
}

export function readAllImagesInDB() {
  const selectImages = db.prepare(`SELECT * FROM ${dbTables.Images}`)
  try {
    const images = selectImages.all() as Image[]
    return images
  } catch (error) {
    console.error(error)
    return [] as Image[]
  }
}

export function readAllPlaylistsInDB() {
  const selectPlaylists = db.prepare(`SELECT * FROM ${dbTables.Playlists}`)
  try {
    const playlists = selectPlaylists.all() as Playlist[]
    return playlists
  } catch (error) {
    console.error(error)
    return [] as Playlist[]
  }
}

export function storeImagesInDB(images: string[]) {
  try {
    const insertImage = db.prepare(`INSERT INTO Images (name) VALUES (?)`)
    const selectInsertedImage = db.prepare(
      `SELECT * FROM Images WHERE id >= last_insert_rowid();`
    )
    const imagesInserted: Image[] = []
    images.forEach((image) => {
      insertImage.run(image)
      const insertedImage = selectInsertedImage.get() as Image
      imagesInserted.push(insertedImage)
    })
    return imagesInserted
  } catch (error) {
    console.error(error)
    return [] as Image[]
  }
}

export function storePlaylistInDB(playlist: rendererPlaylist) {
  try {
    const insertPlaylist = db.prepare(
      `INSERT INTO Playlists (name, type, interval, showAnimations, "order") VALUES (?, ?, ?, ?, ?)`
    )
    insertPlaylist.run(
      playlist.name,
      playlist.configuration.playlistType,
      playlist.configuration.interval ?? null,
      playlist.configuration.showTransition === true ? 1 : 0,
      playlist.configuration.order ?? null
    )
    const selectInsertedPlaylist = db.prepare(
      `SELECT id FROM ${dbTables.Playlists} WHERE id >= last_insert_rowid();`
    )
    const insertedPlaylist = selectInsertedPlaylist.get().id as number
    insertImagesInPlaylistImagesTable(insertedPlaylist, playlist.images)
    return insertedPlaylist
  } catch (error) {
    console.error(error)
    return null
  }
}

function insertImagesInPlaylistImagesTable(
  playlistID: number,
  images: rendererImage[]
) {
  try {
    const insertImagesInPlaylist = db.prepare(
      `INSERT INTO ${dbTables.imagesInPlaylist} (playlistId, imageId, indexInPlaylist, beginTime, endTime) VALUES (?,?,?,?,?)`
    )
    images.forEach((image, index) => {
      insertImagesInPlaylist.run(
        playlistID,
        image.id,
        index,
        image.beginTime ?? null,
        image.endTime ?? null
      )
    })
  } catch (error) {
    console.error(error)
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
export function checkIfPlaylistExists(playlistName: string) {
  try {
    const selectPlaylist = db.prepare(
      `SELECT * FROM ${dbTables.Playlists} WHERE name = ?`
    )
    const playlist = selectPlaylist.get(playlistName)
    return playlist !== undefined
  } catch (error) {
    console.error(error)
    return false
  }
}
export function updatePlaylistInDB(playlist: rendererPlaylist) {
  try {
    const updatePlaylist = db.prepare(
      `UPDATE ${dbTables.Playlists} SET type=? , interval=? , showAnimations=? ,"order"=? WHERE name=?`
    )
    updatePlaylist.run(
      playlist.configuration.playlistType,
      playlist.configuration.interval,
      playlist.configuration.showTransition === true ? 1 : 0,
      playlist.configuration.order,
      playlist.name
    )
    const selectPlaylist = db.prepare(`SELECT id FROM ${dbTables.Playlists} WHERE name=?`)
    const insertedPlaylist = selectPlaylist.get(playlist.name).id as number
    updateImagesInPlaylist(insertedPlaylist, playlist.images)
    return insertedPlaylist
  } catch (error) {
    console.error(error)
    return null
  }
}
function updateImagesInPlaylist(playlistID: number, images: rendererImage[]) {
  try {
    const deleteAllImages = db.prepare(
      `DELETE FROM ${dbTables.imagesInPlaylist} WHERE playlistID=?`
    )
    deleteAllImages.run(playlistID)
    insertImagesInPlaylistImagesTable(playlistID, images)
  } catch (error) {
    console.error(error)
  }
}
export function deletePlaylistInDB(playlistName: string) {
  try {
    const deletePlaylist = db.preprare(
      `DELETE FROM ${dbTables.Playlists} WHERE name=?`
    )
    deletePlaylist.run(playlistName)
  } catch (error) {
    console.error(error)
    console.error('Failed to delete playlist from DB')
  }
}
export function deleteImageInDB(imageID: number) {
  try {
    const deleteImage = db.prepare(`DELETE FROM ${dbTables.Images} WHERE id=?`)
    deleteImage.run(imageID)
  } catch (error) {
    console.error(error)
    console.error('Failed to delete image from DB')
  }
}
