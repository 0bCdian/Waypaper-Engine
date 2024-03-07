import { db } from '../database/database';
import { appConfig } from './schema';
import { initialAppConfig } from '../../shared/constants';
function createConfigIfNotExists() {
    try {
        const config = db.select().from(appConfig).get();
        if (config === undefined) {
            db.insert(appConfig).values(initialAppConfig);
        }
    } catch (error) {}
}
createConfigIfNotExists();
const config = {
    swww: {
        config: db.select().from(appConfig).where(),
        update: () => {
            config.swww.config = dbOperations.readSwwwConfig();
        }
    },
    app: {
        config: dbOperations.readAppConfig(),
        update: () => {
            config.app.config = dbOperations.readAppConfig();
        }
    },
    script: undefined as undefined | string
};

export default config;
