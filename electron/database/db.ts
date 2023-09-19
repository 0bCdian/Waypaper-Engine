//@ts-ignore
import { checkCacheOrCreateItIfNotExists } from '../appFunctions'
import { nativeBindingLocation, dbLocation } from '../binaries'
const Database = require('better-sqlite3')
checkCacheOrCreateItIfNotExists()
const db = Database(dbLocation, {
  nativeBinding: nativeBindingLocation,
  verbose: console.log
})

function createDB() {
  try {
    const createImagesTable = db.prepare(`CREATE TABLE IF NOT EXISTS "Images" (
	"id"	INTEGER NOT NULL,
	"name"	TEXT NOT NULL UNIQUE,
	"isChecked"	INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY("id" AUTOINCREMENT)
)`)
    const createPlaylistsTable =
      db.prepare(`CREATE TABLE IF NOT EXISTS "Playlists" (
	"id"	INTEGER NOT NULL,
	"name"	TEXT NOT NULL UNIQUE,
	"type"	TEXT NOT NULL,
	"interval"	INTEGER DEFAULT null,
	"showAnimations"	INTEGER NOT NULL DEFAULT 1,
	"order"	TEXT DEFAULT null,
	"currentImageIndex"	INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY("id" AUTOINCREMENT)
)`)

    const createImagesInPlaylistTable =
      db.prepare(`CREATE TABLE IF NOT EXISTS "imagesInPlaylist" (
	"imageID"	INTEGER NOT NULL,
	"playlistID" INTEGER NOT NULL,
	"indexInPlaylist"	INTEGER NOT NULL,
	"beginTime"	INTEGER DEFAULT null,
	"endTime"	INTEGER DEFAULT null,
	FOREIGN KEY("imageID") REFERENCES "Images"("id") ON UPDATE CASCADE ON DELETE CASCADE,
	FOREIGN KEY("playlistID") REFERENCES "Playlists"("id") ON UPDATE CASCADE ON DELETE CASCADE
)`)

    const createSwwwConfigTable =
      db.prepare(`CREATE TABLE IF NOT EXISTS "swwwConfig" (
	"resizeType"	TEXT NOT NULL UNIQUE,
	"fillColor"	TEXT NOT NULL UNIQUE,
	"filterType"	TEXT NOT NULL UNIQUE,
	"transitionType"	TEXT NOT NULL UNIQUE,
	"transitionStep"	INTEGER NOT NULL UNIQUE,
	"transitionDuration"	INTEGER NOT NULL UNIQUE,
	"transitionFPS"	INTEGER NOT NULL UNIQUE,
	"transitionAngle"	INTEGER NOT NULL UNIQUE,
	"transitionPositionType"	TEXT NOT NULL UNIQUE,
	"transitionPosition"	TEXT NOT NULL UNIQUE,
	"transitionPositionIntX"	INTEGER NOT NULL UNIQUE,
	"transitionPositionIntY"	INTEGER NOT NULL UNIQUE,
	"transitionPositionFloatX"	REAL NOT NULL UNIQUE,
	"transitionPositionFloatY"	REAL NOT NULL UNIQUE,
	"invertY"	INTEGER NOT NULL UNIQUE,
	"transitionBezier"	TEXT NOT NULL UNIQUE,
	"transitionWaveX"	INTEGER NOT NULL UNIQUE,
	"transitionWaveY"	INTEGER NOT NULL UNIQUE
)`)
    const createAppConfigTable =
      db.prepare(`CREATE TABLE IF NOT EXISTS "appConfig" (
	"killDaemon"	INTEGER NOT NULL UNIQUE,
	"playlistStartOnFirstImage"	INTEGER NOT NULL UNIQUE,
	"notifications"	INTEGER NOT NULL UNIQUE,
	"swwwAnimations"	INTEGER NOT NULL UNIQUE,
	"introAnimation"	INTEGER NOT NULL UNIQUE,
	"startMinimized" INTEGER NOT NULL UNIQUE
);`)
    const createActivePlaylist =
      db.prepare(`CREATE TABLE IF NOT EXISTS "activePlaylist" (
	"playlistID"	INTEGER UNIQUE,
	PRIMARY KEY("playlistID")
);`)
    createSwwwConfigTable.run()
    createAppConfigTable.run()
    createImagesTable.run()
    createPlaylistsTable.run()
    createImagesInPlaylistTable.run()
    createActivePlaylist.run()
  } catch (error) {
    console.log(error)
    throw new Error('Could not initialize the database tables')
  }
}
createDB()
export default db
