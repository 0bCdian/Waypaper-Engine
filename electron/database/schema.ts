import { text, integer, sqliteTable } from 'drizzle-orm/sqlite-core';
import { type swwwConfig as swwwConfigType } from '../../shared/types/swww';
import { initialAppConfig, initialSwwwConfig } from '../../shared/constants';
import { type appConfigType } from '../../shared/types/app';
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
    format: text('format').notNull()
});

export const playlist = sqliteTable('Playlists', {
    id: integer('id').notNull().primaryKey(),
    name: text('name').notNull().unique(),
    type: text('type').notNull(),
    interval: integer('interval'),
    showAnimations: integer('showAnimations', { mode: 'boolean' })
        .notNull()
        .default(true),
    order: text('order'),
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
    config: text('config', { mode: 'json' })
        .notNull()
        .default(initialSwwwConfig)
        .$type<swwwConfigType>()
});

export const appConfig = sqliteTable('appConfig', {
    config: text('config', { mode: 'json' })
        .notNull()
        .default(initialAppConfig)
        .$type<appConfigType>()
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
    monitor: text('monitor').notNull()
});

export type imageSelectType = typeof image.$inferSelect;
export type imageInsertType = typeof image.$inferInsert;
