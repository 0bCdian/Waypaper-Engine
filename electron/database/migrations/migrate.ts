import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database = require('better-sqlite3');
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { homedir } from 'node:os';
import { join } from 'node:path';
const dbUrl = join(homedir(), '.waypaper_engine', 'images_database.sqlite3');
const nativeBinding = join(
    process.cwd(),
    '..',
    '..',
    '..',
    '/node_modules/better-sqlite3/build/Release/better_sqlite3.node'
);
const sqlite = Database(dbUrl, { nativeBinding });
const db = drizzle(sqlite);

function migrateDB() {
    try {
        migrate(db, { migrationsFolder: './' });
    } catch (error) {
        console.error(error);
    }
}
migrateDB();
