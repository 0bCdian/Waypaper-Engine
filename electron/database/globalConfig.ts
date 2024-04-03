import { DBOperations } from '../database/dbOperations';
import { type appConfigInsertType, type swwwConfigInsertType } from './schema';
import { PlaylistController } from '../playlistController';
import { type ActiveMonitor } from '../../shared/types/monitor';
const playlistControllerInstance = new PlaylistController();
const dbOperations = new DBOperations();
dbOperations.migrateDB();
const configuration = {
    swww: {
        config: dbOperations.createSwwwConfigIfNotExists()
    },
    app: {
        config: dbOperations.createAppConfigIfNotExists()
    },
    script: undefined as string | undefined
};
dbOperations.on('updateAppConfig', (newAppConfig: appConfigInsertType) => {
    configuration.app.config = newAppConfig.config;
    playlistControllerInstance.updateConfig();
});
dbOperations.on('updateSwwwConfig', (newAppConfig: swwwConfigInsertType) => {
    configuration.swww.config = newAppConfig.config;
    playlistControllerInstance.updateConfig();
});
dbOperations.on(
    'upsertPlaylist',
    (playlist: { name: string; monitor: ActiveMonitor }) => {
        playlistControllerInstance.startPlaylist(playlist);
    }
);

dbOperations.on('deletePlaylist', (playlistName: string) => {
    console.log('onDeletePlaylist', playlistName);
});

export { configuration, playlistControllerInstance, dbOperations };
