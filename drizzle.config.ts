import type { Config } from 'drizzle-kit';
const dbLocation = '/home/obsy/.waypaper_engine/images_database.sqlite3';
export default {
    schema: './electron/database/schema.ts',
    out: './electron/database/migrations/',
    driver: 'better-sqlite',
    dbCredentials: {
        url: dbLocation
    }
} satisfies Config;
