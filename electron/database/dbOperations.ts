import db from './db'
import { dbTables, Image, Playlist } from '../types/types'
import {
  rendererPlaylist,
  PLAYLIST_TYPES,
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

export function readImagesFromDB() {
  const selectImages = db.prepare(`SELECT * FROM ${dbTables.Images}`)
  try {
    const images = selectImages.all() as Image[]
    console.log(images)
    return images
  } catch (error) {
    console.error(error)
    return [] as Image[]
  }
}

export function readPlaylistsFromDB() {
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

export function storePlaylistsInDB(playlist: rendererPlaylist) {
  switch (playlist.configuration.playlistType) {
    case PLAYLIST_TYPES.NEVER:
      try {
        const insertPlaylist = db.prepare(
          `INSERT INTO ${dbTables.Playlists} (name,type,showAnimations,"order") VALUES (?,?,?,?)`
        )
        insertPlaylist.run(
          playlist.name,
          playlist.configuration.playlistType,
          playlist.configuration.showTransition === true ? 1 : 0,
          playlist.configuration.order
        )
        const selectInsertedPlaylist = db.prepare(
          `SELECT id FROM ${dbTables.Playlists} WHERE id >= last_insert_rowid();`
        )
        const insertedPlaylist = selectInsertedPlaylist.get() as number
        insertImagesInPlaylist(insertedPlaylist, playlist.images)
        return insertedPlaylist
      } catch (error) {
        console.error(error)
        return null
      }
    case PLAYLIST_TYPES.TIMER:
      try {
        const insertPlaylist = db.prepare(
          `INSERT INTO Playlists (name, type, interval, showAnimations, "order") VALUES (?, ?, ?, ?, ?)`
        )
        if (!playlist.configuration.interval || !playlist.configuration.order) {
          console.error('Interval is null, or order is null')
          return null
        }
        insertPlaylist.run(
          playlist.name,
          playlist.configuration.playlistType,
          playlist.configuration.interval,
          playlist.configuration.showTransition === true ? 1 : 0,
          playlist.configuration.order
        )
        const selectInsertedPlaylist = db.prepare(
          `SELECT id FROM ${dbTables.Playlists} WHERE id >= last_insert_rowid();`
        )
        const insertedPlaylist = selectInsertedPlaylist.get().id as number
        console.log('Inserted playlist: ', insertedPlaylist)
        insertImagesInPlaylist(insertedPlaylist, playlist.images)
        return insertedPlaylist
      } catch (error) {
        console.error(error)
        return null
      }
    case PLAYLIST_TYPES.TIME_OF_DAY:
      try {
        const insertPlaylist = db.prepare(
          `INSERT INTO ${dbTables.Playlists} (name,type,showAnimations) VALUES (?,?,?)`
        )
        insertPlaylist.run(
          playlist.name,
          playlist.configuration.playlistType,
          playlist.configuration.showTransition
        )
        const selectInsertedPlaylist = db.prepare(
          `SELECT id FROM ${dbTables.Playlists} WHERE id >= last_insert_rowid();`
        )
        const insertedPlaylist = selectInsertedPlaylist.get() as number
        insertImagesInPlaylist(insertedPlaylist, playlist.images)
        return insertedPlaylist
      } catch (error) {
        console.error(error)
        return null
      }
    case PLAYLIST_TYPES.DAY_OF_WEEK:
      try {
        const insertPlaylist = db.prepare(
          `INSERT INTO ${dbTables.Playlists} (name,type,showAnimations) VALUES (?,?,?)`
        )
        insertPlaylist.run(
          playlist.name,
          playlist.configuration.playlistType,
          playlist.configuration.showTransition
        )
        const selectInsertedPlaylist = db.prepare(
          `SELECT id FROM ${dbTables.Playlists} WHERE id >= last_insert_rowid();`
        )
        const insertedPlaylist = selectInsertedPlaylist.get() as number
        insertImagesInPlaylist(insertedPlaylist, playlist.images)
        return insertedPlaylist
      } catch (error) {
        console.error(error)
        return null
      }
  }
}

function insertImagesInPlaylist(playlistID: number, images: rendererImage[]) {
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
