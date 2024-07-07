import { type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { initialAppConfig, initialSwwwConfig } from "../shared/constants";
import { type ActiveMonitor } from "../shared/types/monitor";
import {
    type rendererImage,
    type rendererPlaylist
} from "../src/types/rendererTypes";
import { type imageMetadata } from "../types/types";
import { createConnector } from "./database";
import * as tables from "./schema";
import { type SQL, asc, desc, eq, sql, notInArray } from "drizzle-orm";
import { EventEmitter } from "node:events";
import { type PLAYLIST_ORDER_TYPES } from "../shared/types/playlist";
import { logger } from "../globals/setup";

export class DBOperations extends EventEmitter {
    db: BetterSQLite3Database;
    constructor() {
        super();
        this.db = createConnector();
    }

    removeActivePlaylist({ activeMonitorName }: { activeMonitorName: string }) {
        this.db
            .delete(tables.activePlaylist)
            .where(
                eq(tables.activePlaylist.activeMonitorName, activeMonitorName)
            )
            .run();
    }

    insertIntoActivePlaylists(row: {
        playlistID: number;
        activeMonitor: ActiveMonitor;
    }) {
        const newRow = { ...row, activeMonitorName: row.activeMonitor.name };
        this.db.insert(tables.activePlaylist).values(newRow).run();
    }

    async upsertPlaylist(playlistObject: rendererPlaylist) {
        const { images, ...playlist } = playlistObject;
        const row: tables.playlistInsertType = {
            name: playlist.name,
            ...playlist.configuration
        };
        const { name, ...partialRow } = row;
        // We will only ever get a one item array, so we return the first and only item
        const [insertedPlaylist] = await this.db
            .insert(tables.playlist)
            .values(row)
            .onConflictDoUpdate({
                target: tables.playlist.name,
                set: partialRow
            })
            .returning({ id: tables.playlist.id });

        this.#insertPlaylistImages(images, insertedPlaylist.id);
        this.emit("upsertPlaylist", {
            name: playlistObject.name,
            activeMonitor: playlistObject.activeMonitor
        });
    }

    #insertPlaylistImages(images: rendererImage[], playlistID: number) {
        const rows = images.map((image, index) => {
            const row: tables.imageInPlaylistInsertType = {
                playlistID,
                time: image.time,
                imageID: image.id,
                indexInPlaylist: index
            };
            return row;
        });
        this.db
            .delete(tables.imageInPlaylist)
            .where(eq(tables.imageInPlaylist.playlistID, playlistID))
            .run();
        this.db.insert(tables.imageInPlaylist).values(rows).run();
    }

    deletePlaylist(playlistName: string) {
        this.db
            .delete(tables.playlist)
            .where(eq(tables.playlist.name, playlistName))
            .run();
        this.emit("deletePlaylist", playlistName);
    }

    getActivePlaylists() {
        return this.db
            .select()
            .from(tables.playlist)
            .innerJoin(
                tables.activePlaylist,
                eq(tables.playlist.id, tables.activePlaylist.playlistID)
            )
            .all();
    }

    getPlaylists() {
        return this.db.select().from(tables.playlist).all();
    }

    getActivePlaylistsInfo() {
        const activePlaylists = this.getActivePlaylists();
        if (activePlaylists.length === 0) return undefined;
        const playlistsInfo = activePlaylists.map(playlist => {
            const images = this.getPlaylistImages(
                playlist.activePlaylists.playlistID,
                playlist.Playlists.order
            );
            const playlistInfo = {
                ...playlist.Playlists,
                images,
                activeMonitor: playlist.activePlaylists.activeMonitor
            };
            return playlistInfo;
        });
        return playlistsInfo;
    }

    getActivePlaylistInfo(monitor: ActiveMonitor) {
        const activePlaylists = this.db
            .select()
            .from(tables.playlist)
            .innerJoin(
                tables.activePlaylist,
                eq(tables.playlist.id, tables.activePlaylist.playlistID)
            )
            .all();
        const activePlaylist = activePlaylists.find(playlist => {
            return playlist.activePlaylists.activeMonitor.name === monitor.name;
        });
        if (activePlaylist === undefined) return;
        const imagesInPlaylist = this.getPlaylistImages(
            activePlaylist.Playlists.id,
            activePlaylist.Playlists.order
        );
        return {
            ...activePlaylist.Playlists,
            images: imagesInPlaylist
        };
    }

    getPlaylistInfo({ name }: { name: string }) {
        const playlist = this.db
            .select()
            .from(tables.playlist)
            .where(eq(tables.playlist.name, name))
            .get();
        if (playlist === undefined) throw new Error("Playlist not found");
        const playlistImages = this.getPlaylistImages(
            playlist.id,
            playlist.order
        );
        return {
            ...playlist,
            images: playlistImages
        };
    }

    getPlaylistImages(playlistID: number, order: PLAYLIST_ORDER_TYPES | null) {
        const orderByID = asc(tables.imageInPlaylist.indexInPlaylist);
        const orderByRandom = asc(sql`RANDOM()`);
        let selectedOrder: SQL<unknown>;
        if (order === null || order === "ordered") {
            selectedOrder = orderByID;
        } else {
            selectedOrder = orderByRandom;
        }
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
            .innerJoin(
                tables.image,
                eq(tables.imageInPlaylist.imageID, tables.image.id)
            )
            .where(eq(tables.imageInPlaylist.playlistID, playlistID))
            .orderBy(selectedOrder)
            .all();
    }

    getAllImages() {
        return this.db
            .select()
            .from(tables.image)
            .orderBy(desc(tables.image.id))
            .all();
    }

    getImageHistory() {
        return this.db
            .select()
            .from(tables.image)
            .innerJoin(
                tables.imageHistory,
                eq(tables.imageHistory.imageID, tables.image.id)
            )
            .orderBy(desc(tables.imageHistory.time))
            .all();
    }

    storeImages(images: imageMetadata[]) {
        const rows: tables.imageInsertType[] = images.map(image => {
            const row: tables.imageInsertType = {
                name: image.name,
                format: image.format,
                width: image.width,
                height: image.height
            };
            return row;
        });
        return this.db.insert(tables.image).values(rows).returning();
    }

    deleteImages(images: rendererImage[]) {
        void this.db.transaction(async tx => {
            for (let idx = 0; idx < images.length; idx++) {
                const currentImage = images[idx];
                await tx
                    .delete(tables.image)
                    .where(eq(tables.image.id, currentImage.id));
            }
        });
    }

    getAppConfig() {
        const appConfig = this.db.select().from(tables.appConfig).get();
        if (appConfig === undefined) {
            return this.createAppConfigIfNotExists();
        } else {
            return appConfig.config;
        }
    }

    async updateAppConfig(newConfig: tables.appConfigInsertType) {
        this.db.delete(tables.appConfig).run();
        this.db.insert(tables.appConfig).values(newConfig).run();
        this.emit("updateAppConfig", newConfig);
    }

    createAppConfigIfNotExists() {
        const result = this.db.select().from(tables.appConfig).get();
        if (result === undefined) {
            this.db
                .insert(tables.appConfig)
                .values({ config: initialAppConfig })
                .run();
            return initialAppConfig;
        }
        return { ...result.config };
    }

    updatePlaylistCurrentIndex({
        name,
        newIndex
    }: {
        name: string;
        newIndex: number;
    }) {
        this.db
            .update(tables.playlist)
            .set({ currentImageIndex: newIndex })
            .where(eq(tables.playlist.name, name))
            .run();
    }

    updateImagesPerPage({ imagesPerPage }: { imagesPerPage: number }) {
        const currentConfig = this.getAppConfig();
        currentConfig.imagesPerPage = imagesPerPage;
        void this.updateAppConfig({ config: currentConfig });
    }

    getSwwwConfig() {
        const swwwConfig = this.db.select().from(tables.swwwConfig).get();
        if (swwwConfig === undefined) {
            return this.createSwwwConfigIfNotExists();
        } else {
            return swwwConfig.config;
        }
    }

    updateSwwwConfig(newConfig: tables.swwwConfigInsertType) {
        this.db.delete(tables.swwwConfig).run();
        this.db.insert(tables.swwwConfig).values(newConfig).run();
        this.emit("updateSwwwConfig", newConfig);
    }

    createSwwwConfigIfNotExists() {
        const result = this.db.select().from(tables.swwwConfig).get();
        if (result === undefined) {
            this.db
                .insert(tables.swwwConfig)
                .values({ config: initialSwwwConfig })
                .returning()
                .run();
            return initialSwwwConfig;
        }
        return { ...result.config };
    }

    setSelectedMonitor(selectedMonitor: ActiveMonitor) {
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
        return selectedMonitor?.monitor;
    }

    getRandomImage({
        limit,
        alreadySetImages
    }: {
        limit: number;
        alreadySetImages: string[];
    }) {
        try {
            const result = this.db
                .select()
                .from(tables.image)
                .where(notInArray(tables.image.name, alreadySetImages))
                .orderBy(sql`random()`)
                .limit(limit)
                .all();
            return result;
        } catch (error) {
            logger.error(error);
            return undefined;
        }
    }

    addImageToHistory({
        image,
        activeMonitor
    }: {
        image: rendererImage | tables.imageSelectType;
        activeMonitor: ActiveMonitor;
    }) {
        const currentImageHistory = this.db
            .select()
            .from(tables.imageHistory)
            .all();
        const row: tables.imageHistoryInsertType = {
            monitor: activeMonitor,
            imageID: image.id
        };
        let shouldUpdate = false;
        currentImageHistory.forEach(existingRow => {
            if (
                existingRow.imageID === row.imageID &&
                existingRow.monitor.name === row.monitor.name
            ) {
                shouldUpdate = true;
            }
        });
        if (shouldUpdate) {
            const query = sql`UPDATE imageHistory SET time=strftime('%s', 'now') WHERE imageID=${row.imageID}`;
            this.db.run(query);
        } else {
            this.db.insert(tables.imageHistory).values(row).run();
        }
        this.emit("updateTray");
    }
}
