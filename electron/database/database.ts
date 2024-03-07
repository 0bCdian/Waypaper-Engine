import {
    drizzle,
    type BetterSQLite3Database
} from 'drizzle-orm/better-sqlite3';

import Database = require('better-sqlite3');
import { dbLocation, nativeBindingLocation } from '../binaries';

const sqlite = Database(dbLocation, {
    nativeBinding: nativeBindingLocation
});

export const db: BetterSQLite3Database = drizzle(sqlite);
