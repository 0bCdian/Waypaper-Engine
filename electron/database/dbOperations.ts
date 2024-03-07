import { db } from './database';
import * as tables from './schema';
import { eq, and } from 'drizzle-orm';

export function getActivePlaylists() {
    return db
        .select()
        .from(tables.playlist)
        .innerJoin(
            tables.activePlaylist,
            eq(tables.playlist.id, tables.activePlaylist.playlistID)
        )
        .all();
}

export function getImageHistory(limit: number, monitor: string) {
    return db
        .select({ name: tables.image.name })
        .from(tables.image)
        .where(
            and(
                eq(tables.imageHistory.imageID, tables.image.id),
                eq(tables.imageHistory.monitor, monitor)
            )
        )
        .limit(limit)
        .all();
}
