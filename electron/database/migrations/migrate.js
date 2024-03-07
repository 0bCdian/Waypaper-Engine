"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var better_sqlite3_1 = require("drizzle-orm/better-sqlite3");
var Database = require("better-sqlite3");
var migrator_1 = require("drizzle-orm/better-sqlite3/migrator");
var node_os_1 = require("node:os");
var node_path_1 = require("node:path");
var dbUrl = (0, node_path_1.join)((0, node_os_1.homedir)(), '.waypaper_engine', 'images_database.sqlite3');
var nativeBinding = (0, node_path_1.join)(process.cwd(), '..', '..', '..', '/node_modules/better-sqlite3/build/Release/better_sqlite3.node');
var sqlite = Database(dbUrl, { nativeBinding: nativeBinding });
var db = (0, better_sqlite3_1.drizzle)(sqlite);
function migrateDB() {
    try {
        (0, migrator_1.migrate)(db, { migrationsFolder: './' });
    }
    catch (error) {
        console.error(error);
    }
}
migrateDB();
