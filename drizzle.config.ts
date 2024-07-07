import type { Config } from "drizzle-kit";
import { homedir } from "os";
import { join } from "path";
const dbLocation = join(homedir(), ".waypaper_engine/images_database.sqlite3");
export default {
    schema: "./database/schema.ts",
    out: "./database/migrations/",
    driver: "better-sqlite",
    dbCredentials: {
        url: dbLocation
    }
} satisfies Config;
