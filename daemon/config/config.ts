import { DBOperations } from '../database/dbOperations';
export const dbOperations = new DBOperations();

export const configuration = {
    swww: {
        settings: dbOperations.getSwwwConfig(),
        update: () => {
            configuration.swww.settings = dbOperations.getSwwwConfig();
        }
    },
    app: {
        settings: dbOperations.getAppConfig(),
        update: () => {
            configuration.app.settings = dbOperations.getAppConfig();
        }
    },
    script: undefined as undefined | string,
    swwwFormat: undefined as undefined | string
};
