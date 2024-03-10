import { text, integer, sqliteTable } from 'drizzle-orm/sqlite-core';
import { type swwwConfig as swwwConfigType } from '../../shared/types/swww';
import {
    type PLAYLIST_TYPES,
    type ORDER_TYPES
} from '../../shared/types/playlist.ts';
import { type appConfigType } from '../../shared/types/app';
import { type Formats } from '../../shared/types/image.ts';

export const image = sqliteTable('Images', {
    id: integer('id').notNull().primaryKey({ autoIncrement: true }),
    name: text('name').notNull().unique(),
    isChecked: integer('isChecked', { mode: 'boolean' })
        .notNull()
        .default(false),
    isSelected: integer('isSelected', { mode: 'boolean' })
        .notNull()
        .default(false),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    format: text('format').notNull().$type<Formats>()
});

export const playlist = sqliteTable('Playlists', {
    id: integer('id').notNull().primaryKey(),
    name: text('name').notNull().unique(),
    type: text('type').notNull().$type<PLAYLIST_TYPES>(),
    interval: integer('interval'),
    showAnimations: integer('showAnimations', { mode: 'boolean' })
        .notNull()
        .default(true),
    order: text('order').$type<ORDER_TYPES>(),
    currentImageIndex: integer('currentImageIndex').notNull().default(0)
});

export const imageInPlaylist = sqliteTable('imagesInPlaylist', {
    imageID: integer('imageID')
        .notNull()
        .references(() => image.id, {
            onUpdate: 'cascade',
            onDelete: 'cascade'
        }),
    playlistID: integer('playlistID')
        .notNull()
        .references(() => playlist.id, {
            onUpdate: 'cascade',
            onDelete: 'cascade'
        }),
    indexInPlaylist: integer('indexInPlaylist').notNull(),
    time: integer('time').unique()
});

export const swwwConfig = sqliteTable('swwwConfig', {
    config: text('config', { mode: 'json' }).notNull().$type<swwwConfigType>()
});

export const appConfig = sqliteTable('appConfig', {
    config: text('config', { mode: 'json' }).notNull().$type<appConfigType>()
});

export const activePlaylist = sqliteTable('activePlaylists', {
    playlistID: integer('playlistID')
        .notNull()
        .references(() => playlist.id),
    monitor: text('monitor').notNull().default('clone')
});

export const imageHistory = sqliteTable('imageHistory', {
    imageID: integer('imageID')
        .notNull()
        .references(() => image.id, { onDelete: 'cascade' }),
    monitor: text('monitor').notNull().$type<'clone' | 'extend' | string>()
});

export type imageSelectType = typeof image.$inferSelect;
export type imageInsertType = typeof image.$inferInsert;
export type swwwConfigSelectType = typeof swwwConfig.$inferSelect;
export type swwwConfigInsertType = typeof swwwConfig.$inferInsert;
export type appConfigSelectType = typeof appConfig.$inferSelect;
export type appConfigInsertType = typeof appConfig.$inferInsert;
export type playlistSelectType = typeof playlist.$inferSelect;
export type playlistInsertType = typeof playlist.$inferInsert;
export type imageInPlaylistSelectType = typeof imageInPlaylist.$inferSelect;
export type imageInPlaylistInsertType = typeof imageInPlaylist.$inferInsert;