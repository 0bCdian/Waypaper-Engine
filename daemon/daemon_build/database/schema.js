"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.selectedMonitor = exports.imageHistory = exports.activePlaylist = exports.appConfig = exports.swwwConfig = exports.imageInPlaylist = exports.playlist = exports.image = void 0;
const sqlite_core_1 = require("drizzle-orm/sqlite-core");
exports.image = (0, sqlite_core_1.sqliteTable)('Images', {
    id: (0, sqlite_core_1.integer)('id').notNull().primaryKey({ autoIncrement: true }),
    name: (0, sqlite_core_1.text)('name').notNull().unique(),
    isChecked: (0, sqlite_core_1.integer)('isChecked', { mode: 'boolean' })
        .notNull()
        .default(false),
    isSelected: (0, sqlite_core_1.integer)('isSelected', { mode: 'boolean' })
        .notNull()
        .default(false),
    width: (0, sqlite_core_1.integer)('width').notNull(),
    height: (0, sqlite_core_1.integer)('height').notNull(),
    format: (0, sqlite_core_1.text)('format').notNull().$type()
});
exports.playlist = (0, sqlite_core_1.sqliteTable)('Playlists', {
    id: (0, sqlite_core_1.integer)('id').notNull().primaryKey(),
    name: (0, sqlite_core_1.text)('name').notNull().unique(),
    type: (0, sqlite_core_1.text)('type').notNull().$type(),
    interval: (0, sqlite_core_1.integer)('interval'),
    showAnimations: (0, sqlite_core_1.integer)('showAnimations', { mode: 'boolean' })
        .notNull()
        .default(true),
    order: (0, sqlite_core_1.text)('order').$type(),
    currentImageIndex: (0, sqlite_core_1.integer)('currentImageIndex').notNull().default(0)
});
exports.imageInPlaylist = (0, sqlite_core_1.sqliteTable)('imagesInPlaylist', {
    imageID: (0, sqlite_core_1.integer)('imageID')
        .notNull()
        .references(() => exports.image.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade'
    }),
    playlistID: (0, sqlite_core_1.integer)('playlistID')
        .notNull()
        .references(() => exports.playlist.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade'
    }),
    indexInPlaylist: (0, sqlite_core_1.integer)('indexInPlaylist').notNull(),
    time: (0, sqlite_core_1.integer)('time').unique()
});
exports.swwwConfig = (0, sqlite_core_1.sqliteTable)('swwwConfig', {
    config: (0, sqlite_core_1.text)('config', { mode: 'json' }).notNull().$type()
});
exports.appConfig = (0, sqlite_core_1.sqliteTable)('appConfig', {
    config: (0, sqlite_core_1.text)('config', { mode: 'json' }).notNull().$type()
});
exports.activePlaylist = (0, sqlite_core_1.sqliteTable)('activePlaylists', {
    playlistID: (0, sqlite_core_1.integer)('playlistID')
        .notNull()
        .references(() => exports.playlist.id),
    monitor: (0, sqlite_core_1.text)('monitor', { mode: 'json' }).notNull().$type()
});
exports.imageHistory = (0, sqlite_core_1.sqliteTable)('imageHistory', {
    imageID: (0, sqlite_core_1.integer)('imageID')
        .notNull()
        .references(() => exports.image.id, { onDelete: 'cascade' }),
    monitor: (0, sqlite_core_1.text)('monitor', { mode: 'json' }).notNull().$type()
});
exports.selectedMonitor = (0, sqlite_core_1.sqliteTable)('selectedMonitor', {
    monitor: (0, sqlite_core_1.text)('monitor', { mode: 'json' }).notNull().$type()
});
//# sourceMappingURL=schema.js.map