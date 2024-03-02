// @ts-expect-error workaround for typescript better-sqlite3
import Database from "better-sqlite3";
import {
    dbTables,
    type PlaylistDB,
    type imageInPlaylist,
    type initialAppConfig,
    type swwwConfig,
    type Image,
    type PlaylistType,
    type initialAppConfigDB
} from "../types/daemonTypes";
import { homedir } from "node:os";
import { join } from "node:path";

function createConnection() {
    try {
        const db = Database(
            join(homedir(), ".waypaper_engine", "images_database.sqlite3"),
            {
                fileMustExist: true,
                timeout: 10000
            }
        );
        return db;
    } catch (error) {
        console.error(error);
        throw error;
    }
}

const dbOperations = {
    connection: createConnection(),
    getImagesInPlaylist: function (playlistID: number) {
        try {
            const selectImagesInPlaylist = dbOperations.connection.prepare(
                `SELECT * FROM ${dbTables.imagesInPlaylist} WHERE playlistId = ? ORDER BY indexInPlaylist ASC`
            );
            const imagesInPlaylist = selectImagesInPlaylist.all(
                playlistID
            ) as imageInPlaylist[];
            if (imagesInPlaylist.length === 0) return undefined;
            const imagesArray: Array<{ name: string; time: number | null }> =
                [];
            for (
                let current = 0;
                current < imagesInPlaylist.length;
                current++
            ) {
                const currentName = dbOperations.getImageNameFromID(
                    imagesInPlaylist[current].imageID
                );
                if (currentName !== null) {
                    imagesArray.push({
                        name: currentName,
                        time: imagesInPlaylist[current].time
                    });
                }
            }
            return imagesArray;
        } catch (error) {
            throw new Error(
                `Could not connect to the database\n Error:\n${error as string}`
            );
        }
    },
    getNewImagesInPlaylist(playlistID: number) {
        try {
            const selectImagesInPlaylist = dbOperations.connection.prepare(
                `SELECT name,time FROM imagesInPlaylist INNER JOIN Images ON imagesInPlaylist.imageID = Images.id AND imagesInPlaylist.playlistID = ? ORDER BY indexInPlaylist ASC`
            );
            const imagesInPlaylist = selectImagesInPlaylist.all(
                playlistID
            ) as imageInPlaylist[];
            return imagesInPlaylist.length > 0 ? imagesInPlaylist : undefined;
        } catch (error) {
            throw new Error(
                `Could not connect to the database\n Error:\n${error as string}`
            );
        }
    },
    getImageNameFromID: function (imageID: number) {
        try {
            const selectImage = dbOperations.connection.prepare(
                `SELECT name FROM ${dbTables.Images} WHERE id = ?`
            );
            const image = selectImage.get(imageID) as { name: string };
            return image.name;
        } catch (error) {
            throw new Error(
                `Could not connect to the database\n Error:\n${error as string}`
            );
        }
    },
    updatePlaylistCurrentIndex: function (
        imageIndex: number,
        playlistName: string
    ) {
        try {
            const updatePlaylist = dbOperations.connection.prepare(
                `UPDATE ${dbTables.Playlists} SET currentImageIndex = ? WHERE name = ?`
            );
            updatePlaylist.run(imageIndex, playlistName);
        } catch (error) {
            throw new Error(
                `Could not connect to the database\n Error:\n${error as string}`
            );
        }
    },
    readAppConfig: function () {
        try {
            const resultDB = dbOperations.connection
                .prepare(`SELECT * FROM ${dbTables.appConfig}`)
                .all();
            const appConfigDB = resultDB[0] as initialAppConfigDB;
            const parsedConfig: initialAppConfig = {
                swwwAnimations: Boolean(appConfigDB.swwwAnimations),
                killDaemon: Boolean(appConfigDB.killDaemon),
                playlistStartOnFirstImage: Boolean(
                    appConfigDB.playlistStartOnFirstImage
                ),
                notifications: Boolean(appConfigDB.notifications),
                introAnimation: Boolean(appConfigDB.introAnimation),
                startMinimized: Boolean(appConfigDB.startMinimized)
            };
            return parsedConfig;
        } catch (error) {
            throw new Error(
                `Could not connect to the database\n Error:\n${error as string}`
            );
        }
    },
    readSwwwConfig: function () {
        try {
            const [swwwConfigObject] = dbOperations.connection
                .prepare(`SELECT * FROM ${dbTables.swwwConfig}`)
                .all();
            return swwwConfigObject as swwwConfig;
        } catch (error) {
            throw new Error(
                `Could not connect to the database\n Error:\n${error as string}`
            );
        }
    },
    readCurrentPlaylistID: function () {
        const currentPlaylistID = dbOperations.connection
            .prepare(`SELECT * FROM ${dbTables.activePlaylist}`)
            .all() as [{ playlistID: number }] | [];
        return currentPlaylistID[0];
    },
    getCurrentPlaylist: function (): PlaylistType | undefined {
        try {
            const result = dbOperations.readCurrentPlaylistID();
            if (result === undefined) return;
            const [playlist] = dbOperations.connection
                .prepare(`SELECT * FROM ${dbTables.Playlists} WHERE id=?`)
                .all(result.playlistID) as [PlaylistDB | undefined];
            if (playlist === undefined) return;
            const imagesInPlaylist = dbOperations.getImagesInPlaylist(
                playlist.id
            );
            if (imagesInPlaylist !== undefined) {
                return {
                    ...playlist,
                    images: imagesInPlaylist
                };
            }
        } catch (error) {
            throw new Error(
                `Could not connect to the database\n Error:\n${error as string}`
            );
        }
    },
    readAllImagesInDB() {
        const selectImages = dbOperations.connection.prepare(
            `SELECT * FROM ${dbTables.Images}`
        );
        try {
            const images = selectImages.all() as Image[];
            return images.length > 0 ? images : undefined;
        } catch (error) {
            throw new Error(
                `Could not connect to the database\n Error:\n${error as string}`
            );
        }
    },
    setActivePlaylistToNull() {
        try {
            dbOperations.connection
                .prepare(`UPDATE ${dbTables.activePlaylist} SET playlistID=0`)
                .run();
        } catch (error) {
            throw new Error(
                `Could not connect to the database\n Error:\n${error as string}`
            );
        }
    }
};

export default dbOperations;
