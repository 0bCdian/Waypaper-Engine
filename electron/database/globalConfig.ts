import { DBOperations } from '../database/dbOperations';
import { type appConfigInsertType, type swwwConfigInsertType } from './schema';
import { PlaylistController } from '../playlistController';
const playlistControllerInstance = new PlaylistController();
const dbOperations = new DBOperations();
dbOperations.migrateDB();
const config = {
    swww: {
        config: dbOperations.createSwwwConfigIfNotExists()
    },
    app: {
        config: dbOperations.createAppConfigIfNotExists()
    },
    script: undefined as string | undefined
};
dbOperations.on('updateAppConfig', (newAppConfig: appConfigInsertType) => {
    config.app.config = newAppConfig.config;
});
dbOperations.on('updateSwwwConfig', (newAppConfig: swwwConfigInsertType) => {
    config.swww.config = newAppConfig.config;
});
dbOperations.on('upsertPlaylist', (id: number, monitor: string) => {
    playlistControllerInstance.updatePlaylist({ id, monitor });
});

dbOperations.on('deletePlaylist', (playlistName: string) => {
    playlistControllerInstance.stopPlaylist({ name: playlistName });
});

export { config, playlistControllerInstance, dbOperations };
