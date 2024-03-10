import { homedir } from 'node:os';
import { join } from 'node:path';

const systemHome = homedir();
const cacheDirectoryRoot = join(systemHome, '.cache', 'waypaper_engine');
const cacheThumbnailsDirectory = join(cacheDirectoryRoot, 'thumbnails');
const mainDirectory = join(systemHome, '.waypaper_engine');
const imagesDir = join(mainDirectory, 'images');
const tempImages = join(mainDirectory, 'tempImages');
export const appDirectories = {
    systemHome,
    rootCache: cacheDirectoryRoot,
    thumbnails: cacheThumbnailsDirectory,
    mainDir: mainDirectory,
    imagesDir,
    tempImages
};
export const WAYPAPER_ENGINE_SOCKET_PATH = '/tmp/waypaper_engine_daemon.sock';
