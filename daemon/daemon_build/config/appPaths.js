"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WAYPAPER_ENGINE_SOCKET_PATH = exports.appDirectories = void 0;
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const systemHome = (0, node_os_1.homedir)();
const cacheDirectoryRoot = (0, node_path_1.join)(systemHome, '.cache', 'waypaper_engine');
const cacheThumbnailsDirectory = (0, node_path_1.join)(cacheDirectoryRoot, 'thumbnails');
const mainDirectory = (0, node_path_1.join)(systemHome, '.waypaper_engine');
const imagesDir = (0, node_path_1.join)(mainDirectory, 'images');
const tempImages = (0, node_path_1.join)(mainDirectory, 'tempImages');
exports.appDirectories = {
    systemHome,
    rootCache: cacheDirectoryRoot,
    thumbnails: cacheThumbnailsDirectory,
    mainDir: mainDirectory,
    imagesDir,
    tempImages
};
exports.WAYPAPER_ENGINE_SOCKET_PATH = '/tmp/waypaper_engine_daemon.sock';
//# sourceMappingURL=appPaths.js.map