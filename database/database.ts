import {
    drizzle,
    type BetterSQLite3Database
} from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import {
    nativeBindingPath,
    migrationsPathDaemon,
    migrationsPath
} from '../globals/setup';
import Database = require('better-sqlite3');
import { homedir } from 'node:os';
import { join } from 'node:path';
const dbPath = join(homedir(), '.waypaper_engine', 'images_database.sqlite3');
const isDaemon = process.env.PROCESS === 'daemon';
const migrations = isDaemon ? migrationsPathDaemon : migrationsPath;

export function createConnector() {
    if (isDaemon) {
        try {
            const sqlite = Database(dbPath);
            const drizzleDB: BetterSQLite3Database = drizzle(sqlite, {
                logger: true
            });
            return drizzleDB;
        } catch (error) {
            console.error(error);
            throw new Error(
                `Could not create better-sqlite3 connector deamon ${__dirname} dirname`
            );
        }
    }
    try {
        const sqlite = Database(dbPath, { nativeBinding: nativeBindingPath });
        const drizzleDB: BetterSQLite3Database = drizzle(sqlite);
        return drizzleDB;
    } catch (error) {
        console.error(error);
        throw new Error(
            `Could not create better-sqlite3 connector electron ${__dirname} dirname`
        );
    }
}

export function migrateDB() {
    try {
        const drizzleDB = createConnector();
        migrate(drizzleDB, { migrationsFolder: migrations });
    } catch (error) {
        console.error(error);
    }
}

migrateDB();
