"use strict";
var __assign =
    (this && this.__assign) ||
    function () {
        __assign =
            Object.assign ||
            function (t) {
                for (var s, i = 1, n = arguments.length; i < n; i++) {
                    s = arguments[i];
                    for (var p in s)
                        if (Object.prototype.hasOwnProperty.call(s, p))
                            t[p] = s[p];
                }
                return t;
            };
        return __assign.apply(this, arguments);
    };
var __importDefault =
    (this && this.__importDefault) ||
    function (mod) {
        return mod && mod.__esModule ? mod : { default: mod };
    };
Object.defineProperty(exports, "__esModule", { value: true });
var better_sqlite3_1 = __importDefault(require("better-sqlite3"));
var daemonTypes_1 = require("../types/daemonTypes");
var node_os_1 = require("node:os");
var node_path_1 = require("node:path");
function createConnection() {
    try {
        var db = (0, better_sqlite3_1.default)(
            (0, node_path_1.join)(
                (0, node_os_1.homedir)(),
                ".waypaper_engine",
                "images_database.sqlite3"
            ),
            { fileMustExist: true, timeout: 10000 }
        );
        return db;
    } catch (error) {
        console.error(error);
        throw error;
    }
}
var dbOperations = {
    connection: createConnection(),
    getImagesInPlaylist: function (playlistID) {
        try {
            var selectImagesInPlaylist = dbOperations.connection.prepare(
                "SELECT * FROM ".concat(
                    daemonTypes_1.dbTables.imagesInPlaylist,
                    " WHERE playlistId = ? ORDER BY indexInPlaylist ASC"
                )
            );
            var imagesInPlaylist = selectImagesInPlaylist.all(playlistID);
            if (imagesInPlaylist.length === 0) return undefined;
            var imagesArray = [];
            for (
                var current = 0;
                current < imagesInPlaylist.length;
                current++
            ) {
                var currentName = dbOperations.getImageNameFromID(
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
                "Could not connect to the database\n Error:\n".concat(error)
            );
        }
    },
    getNewImagesInPlaylist: function (playlistID) {
        try {
            var selectImagesInPlaylist = dbOperations.connection.prepare(
                "SELECT name,time FROM imagesInPlaylist INNER JOIN Images ON imagesInPlaylist.imageID = Images.id AND imagesInPlaylist.playlistID = ? ORDER BY indexInPlaylist ASC"
            );
            var imagesInPlaylist = selectImagesInPlaylist.all(playlistID);
            return imagesInPlaylist.length > 0 ? imagesInPlaylist : undefined;
        } catch (error) {
            throw new Error(
                "Could not connect to the database\n Error:\n".concat(error)
            );
        }
    },
    getImageNameFromID: function (imageID) {
        try {
            var selectImage = dbOperations.connection.prepare(
                "SELECT name FROM ".concat(
                    daemonTypes_1.dbTables.Images,
                    " WHERE id = ?"
                )
            );
            var image = selectImage.get(imageID);
            return image.name;
        } catch (error) {
            throw new Error(
                "Could not connect to the database\n Error:\n".concat(error)
            );
        }
    },
    updatePlaylistCurrentIndex: function (imageIndex, playlistName) {
        try {
            var updatePlaylist = dbOperations.connection.prepare(
                "UPDATE ".concat(
                    daemonTypes_1.dbTables.Playlists,
                    " SET currentImageIndex = ? WHERE name = ?"
                )
            );
            updatePlaylist.run(imageIndex, playlistName);
        } catch (error) {
            throw new Error(
                "Could not connect to the database\n Error:\n".concat(error)
            );
        }
    },
    readAppConfig: function () {
        try {
            var getConfig = dbOperations.connection
                .prepare(
                    "SELECT * FROM ".concat(daemonTypes_1.dbTables.appConfig)
                )
                .all()[0];
            return getConfig;
        } catch (error) {
            throw new Error(
                "Could not connect to the database\n Error:\n".concat(error)
            );
        }
    },
    readSwwwConfig: function () {
        try {
            var swwwConfigObject = dbOperations.connection
                .prepare(
                    "SELECT * FROM ".concat(daemonTypes_1.dbTables.swwwConfig)
                )
                .all()[0];
            return swwwConfigObject;
        } catch (error) {
            throw new Error(
                "Could not connect to the database\n Error:\n".concat(error)
            );
        }
    },
    readCurrentPlaylistID: function () {
        var currentPlaylistID = dbOperations.connection
            .prepare(
                "SELECT * FROM ".concat(daemonTypes_1.dbTables.activePlaylist)
            )
            .all();
        return currentPlaylistID[0];
    },
    getCurrentPlaylist: function () {
        try {
            var result = dbOperations.readCurrentPlaylistID();
            if (result === undefined) return;
            var playlist = dbOperations.connection
                .prepare(
                    "SELECT * FROM ".concat(
                        daemonTypes_1.dbTables.Playlists,
                        " WHERE id=?"
                    )
                )
                .all(result.playlistID)[0];
            if (playlist === undefined) return;
            var imagesInPlaylist = dbOperations.getImagesInPlaylist(
                playlist.id
            );
            if (imagesInPlaylist !== undefined) {
                return __assign(__assign({}, playlist), {
                    images: imagesInPlaylist
                });
            }
        } catch (error) {
            throw new Error(
                "Could not connect to the database\n Error:\n".concat(error)
            );
        }
    },
    readAllImagesInDB: function () {
        var selectImages = dbOperations.connection.prepare(
            "SELECT * FROM ".concat(daemonTypes_1.dbTables.Images)
        );
        try {
            var images = selectImages.all();
            return images.length > 0 ? images : undefined;
        } catch (error) {
            throw new Error(
                "Could not connect to the database\n Error:\n".concat(error)
            );
        }
    },
    setActivePlaylistToNull: function () {
        try {
            dbOperations.connection
                .prepare(
                    "UPDATE ".concat(
                        daemonTypes_1.dbTables.activePlaylist,
                        " SET playlistID=0"
                    )
                )
                .run();
        } catch (error) {
            throw new Error(
                "Could not connect to the database\n Error:\n".concat(error)
            );
        }
    }
};
exports.default = dbOperations;
