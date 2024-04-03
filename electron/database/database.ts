import {
    drizzle,
    type BetterSQLite3Database
} from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database = require('better-sqlite3');
import { dbLocation, nativeBindingLocation, migrationPath } from '../binaries';
const sqlite = Database(dbLocation, {
    nativeBinding: nativeBindingLocation
});
const drizzleDB: BetterSQLite3Database = drizzle(sqlite, { logger: true });
export function migrateDB() {
    try {
        migrate(drizzleDB, { migrationsFolder: migrationPath });
    } catch (error) {
        console.error(error);
    }
}
export const db = drizzleDB;
