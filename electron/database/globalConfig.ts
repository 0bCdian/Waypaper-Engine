import { DBOperations } from '../database/dbOperations';
const dbOperations = new DBOperations();
dbOperations.migrateDB();
const configuration = {
    swww: {
        config: dbOperations.createSwwwConfigIfNotExists()
    },
    app: {
        config: dbOperations.createAppConfigIfNotExists()
    },
    script: undefined as string | undefined,
    swwwFormat: undefined as string | undefined
};

export { configuration, dbOperations };
