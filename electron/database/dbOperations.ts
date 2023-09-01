import db from './db'
import { dbTables, Image, Playlist, imageInPlaylist } from '../types/types'
import {
  rendererPlaylist,
  Image as rendererImage,
  ORDER_TYPES
} from '../../src/types/rendererTypes'
import { initialSwwwConfigDB, swwwConfig } from './swwwConfig'
import initialAppConfig from './appConfig'
import { AppConfigDB } from '../../src/routes/AppConfiguration'
export function testDB() {
  const test = db.prepare(
    `SELECT * FROM ${dbTables.Images},${dbTables.Playlists},${dbTables.imagesInPlaylist},${dbTables.swwwConfig},${dbTables.appConfig}`
  )
  try {
    test.run()
  } catch (error) {
    console.error(error)
    throw new Error('Could not comunicate with the database')
  }
}
function initializeSwwwConfig() {
  try {
    const testIfConfigIsEmpty = db.prepare(
      `SELECT * FROM ${dbTables.swwwConfig}`
    )
    const results = testIfConfigIsEmpty.all()
    if (results.length > 0) {
      return
    }
    const initializeSwwwConfig = db.prepare(
      `INSERT INTO ${dbTables.swwwConfig} (resizeType, fillColor, filterType, transitionType, transitionStep, transitionDuration, transitionFPS, transitionAngle, transitionPositionType, transitionPosition, transitionPositionIntX, transitionPositionIntY, transitionPositionFloatX, transitionPositionFloatY, invertY, transitionBezier, transitionWaveX, transitionWaveY)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
`
    )
    initializeSwwwConfig.run(
      initialSwwwConfigDB.resizeType,
      initialSwwwConfigDB.fillColor,
      initialSwwwConfigDB.filterType,
      initialSwwwConfigDB.transitionType,
      initialSwwwConfigDB.transitionStep,
      initialSwwwConfigDB.transitionDuration,
      initialSwwwConfigDB.transitionFPS,
      initialSwwwConfigDB.transitionAngle,
      initialSwwwConfigDB.transitionPositionType,
      initialSwwwConfigDB.transitionPosition,
      initialSwwwConfigDB.transitionPositionIntX,
      initialSwwwConfigDB.transitionPositionIntY,
      initialSwwwConfigDB.transitionPositionFloatX,
      initialSwwwConfigDB.transitionPositionFloatY,
      initialSwwwConfigDB.invertY,
      initialSwwwConfigDB.transitionBezier,
      initialSwwwConfigDB.transitionWaveX,
      initialSwwwConfigDB.transitionWaveY
    )
  } catch (error) {
    console.error(error)
    console.error('Could not initialize swwwConfig')
  }
}
function initializeAppConfig() {
  try {
    const testIfConfigIsEmpty = db.prepare(
      `SELECT * FROM ${dbTables.appConfig}`
    )
    const results = testIfConfigIsEmpty.all()
    if (results.length > 0) {
      return
    }
    const initializeAppConfig = db.prepare(
      `INSERT INTO ${dbTables.appConfig} (killDaemon,playlistStartOnFirstImage,notifications,swwwAnimations,introAnimation,startMinimized) VALUES(?,?,?,?,?,?)`
    )
    initializeAppConfig.run(
      initialAppConfig.killDaemon,
      initialAppConfig.playlistStartOnFirstImage,
      initialAppConfig.notifications,
      initialAppConfig.swwwAnimations,
      initialAppConfig.introAnimation,
      initialAppConfig.startMinimized
    )
  } catch (error) {
    throw new Error(`Could not initialize the appConfig table\n ${error}`)
  }
}

export function createInitialConfigIfNotExists() {
  initializeSwwwConfig()
  initializeAppConfig()
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
  purgePlaylistsWithoutImages()
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
  if (playlist.configuration.order === ORDER_TYPES.RANDOM) {
    playlist.images.sort(() => Math.random() - 0.5)
  }
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
    const selectPlaylist = db.prepare(
      `SELECT id FROM ${dbTables.Playlists} WHERE name=?`
    )
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
    throw new Error('Failed to delete image from DB')
  }
}

function purgePlaylistsWithoutImages() {
  try {
    const purgeImages = db.prepare(
      `DELETE FROM ${dbTables.Playlists} WHERE id NOT IN (SELECT DISTINCT playlistID FROM ${dbTables.imagesInPlaylist})`
    )
    purgeImages.run()
  } catch (error) {
    console.error(error)
    throw error
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

export function updateSwwwConfig(newConfig: swwwConfig) {
  try {
    const updateStatement = db.prepare(
      `UPDATE ${dbTables.swwwConfig} SET resizeType=? , fillColor=? , filterType=? , transitionType=? , transitionStep=? , transitionDuration=? ,transitionFPS=? , transitionAngle=?, transitionPositionType=?, transitionPosition=? , transitionPositionIntX=? , transitionPositionIntY=? , transitionPositionFloatX=? ,transitionPositionFloatY=? , invertY=? , transitionBezier=? , transitionWaveX=? , transitionWaveY=?`
    )
    const invertY = newConfig.invertY ? 1 : 0
    updateStatement.run(
      newConfig.resizeType,
      newConfig.fillColor,
      newConfig.filterType,
      newConfig.transitionType,
      newConfig.transitionStep,
      newConfig.transitionDuration,
      newConfig.transitionFPS,
      newConfig.transitionAngle,
      newConfig.transitionPositionType,
      newConfig.transitionPosition,
      newConfig.transitionPositionIntX,
      newConfig.transitionPositionIntY,
      newConfig.transitionPositionFloatX,
      newConfig.transitionPositionFloatY,
      invertY,
      newConfig.transitionBezier,
      newConfig.transitionWaveX,
      newConfig.transitionWaveY
    )
  } catch (error) {
    console.error(error)
    throw new Error('Could not update the swwwConfig')
  }
}

export function readAppConfig() {
  try {
    const [getConfig] = db.prepare(`SELECT * FROM ${dbTables.appConfig}`).all()
    return getConfig as typeof initialAppConfig
  } catch (error) {
    console.error(error)
    throw new Error('Could not read app configuration from the database')
  }
}

export function updateAppConfig(newAppConfig: AppConfigDB) {
  try {
    const updateAppConfig = db.prepare(
      `UPDATE ${dbTables.appConfig} SET killDaemon=?,playlistStartOnFirstImage=?,notifications=?,swwwAnimations=?,introAnimation=?,startMinimized=?`
    )
    updateAppConfig.run(
      newAppConfig.killDaemon,
      newAppConfig.playlistStartOnFirstImage,
      newAppConfig.notifications,
      newAppConfig.swwwAnimations,
      newAppConfig.introAnimation,
      newAppConfig.startMinimized
    )
  } catch (error) {
    throw new Error(`Could not update appConfigTable in DB ${error}`)
  }
}
