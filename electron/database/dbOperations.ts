import { initialAppConfig, initialSwwwConfig } from '../../shared/constants';
import {
    type rendererImage,
    type rendererPlaylist
} from '../../src/types/rendererTypes';
import { type imageMetadata } from '../types/types';
import { db, migrateDB } from './database';
import * as tables from './schema';
import { eq } from 'drizzle-orm';
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
        this.emit('upsertPlaylist', playlist.id, playlistObject.monitor);
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

    getActivePlaylistInfo(monitor: string) {
        const activePlaylist = db
            .select()
            .from(tables.playlist)
            .innerJoin(
                tables.activePlaylist,
                eq(tables.playlist.id, tables.activePlaylist.playlistID)
            )
            .where(eq(tables.activePlaylist.monitor, monitor))
            .get();
        if (activePlaylist === undefined) return;
        const imagesInPlaylist = db
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
            .from(tables.image)
            .innerJoin(
                tables.imageInPlaylist,
                eq(tables.imageInPlaylist.imageID, tables.image.id)
            )
            .where(
                eq(
                    tables.imageInPlaylist.playlistID,
                    activePlaylist.Playlists.id
                )
            )
            .orderBy(tables.imageInPlaylist.indexInPlaylist)
            .all();
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
            .from(tables.image)
            .innerJoin(
                tables.imageInPlaylist,
                eq(tables.imageInPlaylist.playlistID, playlistID)
            )
            .orderBy(tables.imageInPlaylist.indexInPlaylist)
            .all();
    }

    getAllImages() {
        return db.select().from(tables.image).all();
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
        void db.insert(tables.image).values(rows);
    }

    deleteImage(id: number) {
        void db.delete(tables.image).where(eq(tables.image.id, id));
    }

    getAppConfig() {
        return db.select().from(tables.appConfig).get()?.config;
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

    getSwwwConfig() {
        return db.select().from(tables.swwwConfig).get()?.config;
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
}
