import { homedir } from 'node:os';
import { join } from 'node:path';
import { values } from './setup';
import chokidar from 'chokidar';
import { DBOperations } from '../database/dbOperations';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
const systemHome = homedir();
const cacheDirectoryRoot = join(systemHome, '.cache', 'waypaper_engine');
const cacheThumbnailsDirectory = join(cacheDirectoryRoot, 'thumbnails');
const mainDirectory = join(systemHome, '.waypaper_engine');
const imagesDir = join(mainDirectory, 'images');
const scriptsDir = join(mainDirectory, 'scripts');
const extendedImages = join(cacheDirectoryRoot, 'extended_images_cache');
const WAYPAPER_ENGINE_DAEMON_SOCKET_PATH = '/tmp/waypaper_engine_daemon.sock';
const WAYPAPER_ENGINE_SOCKET_PATH = '/tmp/waypaper_engine.sock';
const appDirectories = {
    systemHome,
    rootCache: cacheDirectoryRoot,
    thumbnails: cacheThumbnailsDirectory,
    mainDir: mainDirectory,
    imagesDir,
    scriptsDir,
    extendedImages,
    WAYPAPER_ENGINE_SOCKET_PATH,
    WAYPAPER_ENGINE_DAEMON_SOCKET_PATH
};
const dbOperations = new DBOperations();
let scripts: string[] = [];
const scriptsPath = join(homedir(), '.waypaper_engine', 'scripts');
if (!existsSync(scriptsPath)) {
    mkdirSync(scriptsPath);
}
scripts = readdirSync(scriptsPath).map(fileName => {
    return join(scriptsPath, fileName);
});

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
    scripts,
    format: (values.format ?? false) as boolean,
    logs: (values.logs ?? false) as boolean
};
const watcher = chokidar.watch(scriptsPath, { persistent: true });
watcher
    .on('add', () => {
        configuration.scripts = readdirSync(scriptsPath).map(fileName => {
            return join(scriptsPath, fileName);
        });
    })
    .on('remove', () => {
        configuration.scripts = readdirSync(scriptsPath).map(fileName => {
            return join(scriptsPath, fileName);
        });
    });
export { configuration, dbOperations };
