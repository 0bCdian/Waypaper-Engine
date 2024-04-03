import {
    drizzle,
    type BetterSQLite3Database
} from 'drizzle-orm/better-sqlite3';
import Database = require('better-sqlite3');
import { join } from 'node:path';
import { homedir } from 'node:os';
const DB_LOCATION = join(homedir(), '.waypaper_engine/images_database.sqlite3');
const sqlite = Database(DB_LOCATION);
const drizzleDB: BetterSQLite3Database = drizzle(sqlite);

export function createConnector() {
    const sqlite = Database(DB_LOCATION);
    const drizzleDB: BetterSQLite3Database = drizzle(sqlite);
    return drizzleDB;
}
export const db = drizzleDB;
