import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { initialAppConfig, initialSwwwConfig } from '../types/constants';
import {
    type rendererImage,
    type rendererPlaylist,
    type imageMetadata,
    type ActiveMonitor
} from '../types/daemonTypes';
import { createConnector } from './database';
import * as tables from './schema';
import { asc, desc, eq, sql } from 'drizzle-orm';

export class DBOperations {
    db: BetterSQLite3Database;
    constructor() {
        this.db = createConnector();
    }

    removeActivePlaylist({ playlistName }: { playlistName: string }) {
        const playlist = this.db
            .select()
            .from(tables.playlist)
            .where(eq(tables.playlist.name, playlistName))
            .get();
        if (playlist === undefined) {
            return;
        }
        this.db
            .delete(tables.activePlaylist)
            .where(eq(tables.activePlaylist.playlistID, playlist.id))
            .run();
    }

    insertIntoActivePlaylists(row: {
        playlistID: number;
        monitor: ActiveMonitor;
    }) {
        this.db.insert(tables.activePlaylist).values(row).run();
    }

    async upsertPlaylist(playlistObject: rendererPlaylist) {
        const row: tables.playlistInsertType = {
            name: playlistObject.name,
            type: playlistObject.configuration.playlistType,
            interval: playlistObject.configuration.interval,
            order: playlistObject.configuration.order,
            showAnimations: playlistObject.configuration.showAnimations
        };
        // We will only ever get a one item array, so we return the first and only item
        const [playlist] = await this.db
            .insert(tables.playlist)
            .values(row)
            .returning({ id: tables.playlist.id })
            .onConflictDoUpdate({ target: tables.playlist.id, set: row });
        this.#insertPlaylistImages(playlistObject.images, playlist.id);
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
            return playlist.activePlaylists.monitor.name === monitor.name;
        });
        if (activePlaylist === undefined) return;
        const imagesInPlaylist = this.getPlaylistImages(
            activePlaylist.Playlists.id
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
        if (playlist === undefined) throw new Error('Playlist not found');
        const playlistImages = this.getPlaylistImages(playlist.id);
        return {
            ...playlist,
            images: playlistImages
        };
    }

    getPlaylistImages(playlistID: number) {
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
            .orderBy(asc(tables.imageInPlaylist.indexInPlaylist))
            .all();
    }

    getAllImages() {
        return this.db
            .select()
            .from(tables.image)
            .orderBy(desc(tables.image.id))
            .all();
    }

    getImageHistory(limit: number) {
        return this.db
            .select()
            .from(tables.image)
            .innerJoin(
                tables.imageHistory,
                eq(tables.imageHistory.imageID, tables.image.id)
            )
            .limit(limit)
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
        return result.config;
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

    addImageToHistory({
        image,
        activeMonitor
    }: {
        image: rendererImage;
        activeMonitor: ActiveMonitor;
    }) {
        const row: tables.imageHistoryInsertType = {
            monitor: activeMonitor,
            imageID: image.id
        };

        this.db.insert(tables.imageHistory).values(row).run();
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
        return result.config;
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

    getRandomImage(number = 1) {
        try {
            const result = this.db
                .select()
                .from(tables.image)
                .orderBy(sql`random()`)
                .limit(number)
                .all();
            return result;
        } catch (error) {
            console.error(error);
            return undefined;
        }
    }
}
