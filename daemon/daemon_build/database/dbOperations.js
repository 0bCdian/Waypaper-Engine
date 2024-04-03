"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _DBOperations_instances, _DBOperations_insertPlaylistImages;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DBOperations = void 0;
const constants_1 = require("../types/constants");
const database_1 = require("./database");
const tables = __importStar(require("./schema"));
const drizzle_orm_1 = require("drizzle-orm");
class DBOperations {
    constructor() {
        _DBOperations_instances.add(this);
        this.db = (0, database_1.createConnector)();
    }
    removeActivePlaylist({ playlistName }) {
        const playlist = this.db
            .select()
            .from(tables.playlist)
            .where((0, drizzle_orm_1.eq)(tables.playlist.name, playlistName))
            .get();
        if (playlist === undefined) {
            return;
        }
        this.db
            .delete(tables.activePlaylist)
            .where((0, drizzle_orm_1.eq)(tables.activePlaylist.playlistID, playlist.id))
            .run();
    }
    insertIntoActivePlaylists(row) {
        this.db.insert(tables.activePlaylist).values(row).run();
    }
    upsertPlaylist(playlistObject) {
        return __awaiter(this, void 0, void 0, function* () {
            const row = {
                name: playlistObject.name,
                type: playlistObject.configuration.playlistType,
                interval: playlistObject.configuration.interval,
                order: playlistObject.configuration.order,
                showAnimations: playlistObject.configuration.showAnimations
            };
            // We will only ever get a one item array, so we return the first and only item
            const [playlist] = yield this.db
                .insert(tables.playlist)
                .values(row)
                .returning({ id: tables.playlist.id })
                .onConflictDoUpdate({ target: tables.playlist.id, set: row });
            __classPrivateFieldGet(this, _DBOperations_instances, "m", _DBOperations_insertPlaylistImages).call(this, playlistObject.images, playlist.id);
        });
    }
    deletePlaylist(playlistName) {
        this.db
            .delete(tables.playlist)
            .where((0, drizzle_orm_1.eq)(tables.playlist.name, playlistName))
            .run();
    }
    getActivePlaylists() {
        return this.db
            .select()
            .from(tables.playlist)
            .innerJoin(tables.activePlaylist, (0, drizzle_orm_1.eq)(tables.playlist.id, tables.activePlaylist.playlistID))
            .all();
    }
    getPlaylists() {
        return this.db.select().from(tables.playlist).all();
    }
    getActivePlaylistInfo(monitor) {
        const activePlaylists = this.db
            .select()
            .from(tables.playlist)
            .innerJoin(tables.activePlaylist, (0, drizzle_orm_1.eq)(tables.playlist.id, tables.activePlaylist.playlistID))
            .all();
        const activePlaylist = activePlaylists.find(playlist => {
            return playlist.activePlaylists.monitor.name === monitor.name;
        });
        if (activePlaylist === undefined)
            return;
        const imagesInPlaylist = this.getPlaylistImages(activePlaylist.Playlists.id);
        return Object.assign(Object.assign({}, activePlaylist.Playlists), { images: imagesInPlaylist });
    }
    getPlaylistInfo({ name }) {
        const playlist = this.db
            .select()
            .from(tables.playlist)
            .where((0, drizzle_orm_1.eq)(tables.playlist.name, name))
            .get();
        if (playlist === undefined)
            throw new Error('Playlist not found');
        const playlistImages = this.getPlaylistImages(playlist.id);
        return Object.assign(Object.assign({}, playlist), { images: playlistImages });
    }
    getPlaylistImages(playlistID) {
        return this.db
            .select({
            id: tables.image.id,
            name: tables.image.name,
            width: tables.image.width,
            height: tables.image.height,
            isChecked: tables.image.isChecked,
            isSelected: tables.image.isSelected,
            format: tables.image.format,
            time: tables.imageInPlaylist.time
        })
            .from(tables.imageInPlaylist)
            .innerJoin(tables.image, (0, drizzle_orm_1.eq)(tables.imageInPlaylist.imageID, tables.image.id))
            .where((0, drizzle_orm_1.eq)(tables.imageInPlaylist.playlistID, playlistID))
            .orderBy((0, drizzle_orm_1.asc)(tables.imageInPlaylist.indexInPlaylist))
            .all();
    }
    getAllImages() {
        return this.db
            .select()
            .from(tables.image)
            .orderBy((0, drizzle_orm_1.desc)(tables.image.id))
            .all();
    }
    getImageHistory(limit) {
        return this.db
            .select()
            .from(tables.image)
            .innerJoin(tables.imageHistory, (0, drizzle_orm_1.eq)(tables.imageHistory.imageID, tables.image.id))
            .limit(limit)
            .all();
    }
    storeImages(images) {
        const rows = images.map(image => {
            const row = {
                name: image.name,
                format: image.format,
                width: image.width,
                height: image.height
            };
            return row;
        });
        return this.db.insert(tables.image).values(rows).returning();
    }
    deleteImages(images) {
        void this.db.transaction((tx) => __awaiter(this, void 0, void 0, function* () {
            for (let idx = 0; idx < images.length; idx++) {
                const currentImage = images[idx];
                yield tx
                    .delete(tables.image)
                    .where((0, drizzle_orm_1.eq)(tables.image.id, currentImage.id));
            }
        }));
    }
    getAppConfig() {
        const appConfig = this.db.select().from(tables.appConfig).get();
        if (appConfig === undefined) {
            return this.createAppConfigIfNotExists();
        }
        else {
            return appConfig.config;
        }
    }
    updateAppConfig(newConfig) {
        return __awaiter(this, void 0, void 0, function* () {
            this.db.delete(tables.appConfig).run();
            this.db.insert(tables.appConfig).values(newConfig).run();
        });
    }
    createAppConfigIfNotExists() {
        const result = this.db.select().from(tables.appConfig).get();
        if (result === undefined) {
            this.db
                .insert(tables.appConfig)
                .values({ config: constants_1.initialAppConfig })
                .run();
            return constants_1.initialAppConfig;
        }
        return result.config;
    }
    updatePlaylistCurrentIndex({ name, newIndex }) {
        this.db
            .update(tables.playlist)
            .set({ currentImageIndex: newIndex })
            .where((0, drizzle_orm_1.eq)(tables.playlist.name, name))
            .run();
    }
    addImageToHistory({ image, activeMonitor }) {
        const row = {
            monitor: activeMonitor,
            imageID: image.id
        };
        this.db.insert(tables.imageHistory).values(row).run();
    }
    updateImagesPerPage({ imagesPerPage }) {
        const currentConfig = this.getAppConfig();
        currentConfig.imagesPerPage = imagesPerPage;
        void this.updateAppConfig({ config: currentConfig });
    }
    getSwwwConfig() {
        const swwwConfig = this.db.select().from(tables.swwwConfig).get();
        if (swwwConfig === undefined) {
            return this.createSwwwConfigIfNotExists();
        }
        else {
            return swwwConfig.config;
        }
    }
    updateSwwwConfig(newConfig) {
        this.db.delete(tables.swwwConfig).run();
        this.db.insert(tables.swwwConfig).values(newConfig).run();
    }
    createSwwwConfigIfNotExists() {
        const result = this.db.select().from(tables.swwwConfig).get();
        if (result === undefined) {
            this.db
                .insert(tables.swwwConfig)
                .values({ config: constants_1.initialSwwwConfig })
                .returning()
                .run();
            return constants_1.initialSwwwConfig;
        }
        return result.config;
    }
    setSelectedMonitor(selectedMonitor) {
        this.db.delete(tables.selectedMonitor).run();
        this.db
            .insert(tables.selectedMonitor)
            .values({ monitor: selectedMonitor })
            .run();
    }
    getSelectedMonitor() {
        const selectedMonitor = this.db
            .select()
            .from(tables.selectedMonitor)
            .get();
        return selectedMonitor === null || selectedMonitor === void 0 ? void 0 : selectedMonitor.monitor;
    }
    getRandomImage(number = 1) {
        try {
            const result = this.db
                .select()
                .from(tables.image)
                .orderBy((0, drizzle_orm_1.sql) `random()`)
                .limit(number)
                .all();
            return result;
        }
        catch (error) {
            console.error(error);
            return undefined;
        }
    }
}
exports.DBOperations = DBOperations;
_DBOperations_instances = new WeakSet(), _DBOperations_insertPlaylistImages = function _DBOperations_insertPlaylistImages(images, playlistID) {
    const rows = images.map((image, index) => {
        const row = {
            playlistID,
            time: image.time,
            imageID: image.id,
            indexInPlaylist: index
        };
        return row;
    });
    this.db
        .delete(tables.imageInPlaylist)
        .where((0, drizzle_orm_1.eq)(tables.imageInPlaylist.playlistID, playlistID))
        .run();
    this.db.insert(tables.imageInPlaylist).values(rows).run();
};
//# sourceMappingURL=dbOperations.js.map