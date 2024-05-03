import { homedir } from 'node:os';
import { join } from 'node:path';
import { values } from './setup';
import { DBOperations } from '../database/dbOperations';
const systemHome = homedir();
const cacheDirectoryRoot = join(systemHome, '.cache', 'waypaper_engine');
const cacheThumbnailsDirectory = join(cacheDirectoryRoot, 'thumbnails');
const mainDirectory = join(systemHome, '.waypaper_engine');
const imagesDir = join(mainDirectory, 'images');
const extendedImages = join(cacheDirectoryRoot, 'extended_images_cache');
const WAYPAPER_ENGINE_DAEMON_SOCKET_PATH = '/tmp/waypaper_engine_daemon.sock';
const WAYPAPER_ENGINE_SOCKET_PATH = '/tmp/waypaper_engine.sock';
const appDirectories = {
    systemHome,
    rootCache: cacheDirectoryRoot,
    thumbnails: cacheThumbnailsDirectory,
    mainDir: mainDirectory,
    imagesDir,
    extendedImages,
    WAYPAPER_ENGINE_SOCKET_PATH,
    WAYPAPER_ENGINE_DAEMON_SOCKET_PATH
};
const dbOperations = new DBOperations();
const configuration = {
    swww: {
        config: dbOperations.createSwwwConfigIfNotExists(),
        update: () => {
            configuration.swww.config = dbOperations.getSwwwConfig();
        }
    },
    app: {
        config: dbOperations.createAppConfigIfNotExists(),
        update: () => {
            configuration.app.config = dbOperations.getAppConfig();
        }
    },
    directories: appDirectories,
    script: values.script as string | undefined,
    format: (values.format ?? false) as boolean
};

export { configuration, dbOperations };
