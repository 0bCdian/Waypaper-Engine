import {
    drizzle,
    type BetterSQLite3Database
} from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import {
    nativeBindingPath,
    migrationsPathDaemon,
    migrationsPath,
    isDaemon,
    mainDirectory,
    logger
} from "../globals/setup";
import Database = require("better-sqlite3");
import { join } from "node:path";
const dbPath = join(mainDirectory, "images_database.sqlite3");
const migrations = isDaemon ? migrationsPathDaemon : migrationsPath;
export function createConnector() {
    try {
        const sqlite = Database(
            dbPath,
            isDaemon ? undefined : { nativeBinding: nativeBindingPath }
        );
        const drizzleDB: BetterSQLite3Database = drizzle(sqlite);
        return drizzleDB;
    } catch (error) {
        logger.error(error);
        throw new Error(
            `Could not create better-sqlite3 connector ${isDaemon ? "daemon" : "electron"} ${__dirname}`
        );
    }
}

export function migrateDB() {
    try {
        const drizzleDB = createConnector();
        migrate(drizzleDB, { migrationsFolder: migrations });
    } catch (error) {
        logger.error(error);
    }
}

migrateDB();
