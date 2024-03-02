import dbOperations from "./dbOperations";
dbOperations.createInitialConfigIfNotExists();
dbOperations.testDB();
const config = {
    swww: {
        config: dbOperations.readSwwwConfig(),
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
