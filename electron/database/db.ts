//@ts-ignore
const Database = require('better-sqlite3')
import { nativeBindingLocation, dbLocation } from '../binaries'

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

    createImagesTable.run()
    createPlaylistsTable.run()
    createImagesInPlaylistTable.run()
  } catch (error) {
    console.log(error)
  }
}
createDB()
export default db
