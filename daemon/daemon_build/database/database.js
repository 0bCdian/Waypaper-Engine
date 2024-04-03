"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.createConnector = void 0;
const better_sqlite3_1 = require("drizzle-orm/better-sqlite3");
const Database = require("better-sqlite3");
const node_path_1 = require("node:path");
const node_os_1 = require("node:os");
const DB_LOCATION = (0, node_path_1.join)((0, node_os_1.homedir)(), '.waypaper_engine/images_database.sqlite3');
const sqlite = Database(DB_LOCATION);
const drizzleDB = (0, better_sqlite3_1.drizzle)(sqlite);
function createConnector() {
    const sqlite = Database(DB_LOCATION);
    const drizzleDB = (0, better_sqlite3_1.drizzle)(sqlite);
    return drizzleDB;
}
exports.createConnector = createConnector;
exports.db = drizzleDB;
//# sourceMappingURL=database.js.map