import { initialAppConfig, initialSwwwConfig } from '../../shared/constants';
import { type ActiveMonitor } from '../../shared/types/monitor';
import {
    type rendererImage,
    type rendererPlaylist
} from '../../src/types/rendererTypes';
import { type imageMetadata } from '../types/types';
import { db, migrateDB } from './database';
import * as tables from './schema';
import { asc, desc, eq, sql } from 'drizzle-orm';
import { EventEmitter } from 'node:events';

export class DBOperations extends EventEmitter {
    migrateDB() {
        migrateDB();
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
        const [playlist] = await db
            .insert(tables.playlist)
            .values(row)
            .returning({ id: tables.playlist.id })
            .onConflictDoUpdate({ target: tables.playlist.id, set: row });
        this.#insertPlaylistImages(playlistObject.images, playlist.id);
        this.emit('upsertPlaylist', {
            name: playlistObject.name,
            monitor: playlistObject.monitor
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
        db.delete(tables.imageInPlaylist)
            .where(eq(tables.imageInPlaylist.playlistID, playlistID))
            .run();
        db.insert(tables.imageInPlaylist).values(rows).run();
    }

    deletePlaylist(playlistName: string) {
        db.delete(tables.playlist)
            .where(eq(tables.playlist.name, playlistName))
            .run();
        this.emit('deletePlaylist', playlistName);
    }

    getActivePlaylists() {
        return db
            .select()
            .from(tables.playlist)
            .innerJoin(
                tables.activePlaylist,
                eq(tables.playlist.id, tables.activePlaylist.playlistID)
            )
            .all();
    }

    getPlaylists() {
        return db.select().from(tables.playlist).all();
    }

    getActivePlaylistInfo(monitor: ActiveMonitor) {
        const activePlaylists = db
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

    getPlaylistImages(playlistID: number) {
        return db
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
        return db
            .select()
            .from(tables.image)
            .orderBy(desc(tables.image.id))
            .all();
    }

    getImageHistory(limit: number) {
        return db
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
        return db.insert(tables.image).values(rows).returning();
    }

    deleteImages(images: rendererImage[]) {
        void db.transaction(async tx => {
            for (let idx = 0; idx < images.length; idx++) {
                const currentImage = images[idx];
                await tx
                    .delete(tables.image)
                    .where(eq(tables.image.id, currentImage.id));
            }
        });
    }

    getAppConfig() {
        const appConfig = db.select().from(tables.appConfig).get();
        if (appConfig === undefined) {
            return this.createAppConfigIfNotExists();
        } else {
            return appConfig.config;
        }
    }

    async updateAppConfig(newConfig: tables.appConfigInsertType) {
        db.delete(tables.appConfig).run();
        db.insert(tables.appConfig).values(newConfig).run();
        this.emit('updateAppConfig', newConfig);
    }

    createAppConfigIfNotExists() {
        const result = db.select().from(tables.appConfig).get();
        if (result === undefined) {
            db.insert(tables.appConfig)
                .values({ config: initialAppConfig })
                .run();
            return initialAppConfig;
        }
        return { ...result.config };
    }

    updateImagesPerPage({ imagesPerPage }: { imagesPerPage: number }) {
        const currentConfig = this.getAppConfig();
        currentConfig.imagesPerPage = imagesPerPage;
        void this.updateAppConfig({ config: currentConfig });
    }

    getSwwwConfig() {
        const swwwConfig = db.select().from(tables.swwwConfig).get();
        if (swwwConfig === undefined) {
            return this.createSwwwConfigIfNotExists();
        } else {
            return swwwConfig.config;
        }
    }

    updateSwwwConfig(newConfig: tables.swwwConfigInsertType) {
        db.delete(tables.swwwConfig).run();
        db.insert(tables.swwwConfig).values(newConfig).run();
        this.emit('updateSwwwConfig', newConfig);
    }

    createSwwwConfigIfNotExists() {
        const result = db.select().from(tables.swwwConfig).get();
        if (result === undefined) {
            db.insert(tables.swwwConfig)
                .values({ config: initialSwwwConfig })
                .returning()
                .run();
            return initialSwwwConfig;
        }
        return { ...result.config };
    }

    setSelectedMonitor(selectedMonitor: ActiveMonitor) {
        db.delete(tables.selectedMonitor).run();
        db.insert(tables.selectedMonitor)
            .values({ monitor: selectedMonitor })
            .run();
    }

    getSelectedMonitor() {
        const selectedMonitor = db.select().from(tables.selectedMonitor).get();
        return selectedMonitor?.monitor;
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
        db.insert(tables.imageHistory).values(row).run();
    }

    static getRandomImage() {
        try {
            const result = db
                .select()
                .from(tables.image)
                .orderBy(sql`random()`)
                .limit(1)
                .get();
            console.log('this is the result of getRandomImage', result);
        } catch (error) {
            console.error(error);
        }
    }
}
