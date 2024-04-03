"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IPC_MAIN_EVENTS = exports.MENU_EVENTS = exports.SHORTCUT_EVENTS = exports.initialSwwwConfig = exports.initialAppConfig = exports.validImageExtensions = void 0;
const swww_1 = require("./swww");
exports.validImageExtensions = [
    'jpeg',
    'jpg',
    'png',
    'gif',
    'bmp',
    'webp',
    'pnm',
    'tga',
    'tiff',
    'farbfeld'
];
exports.initialAppConfig = {
    killDaemon: false,
    playlistStartOnFirstImage: false,
    notifications: true,
    swwwAnimations: true,
    startMinimized: false,
    minimizeInsteadOfClose: false,
    randomImageMonitor: 'clone',
    showMonitorModalOnStart: true,
    imagesPerPage: 20
};
exports.initialSwwwConfig = {
    resizeType: swww_1.ResizeType.crop,
    fillColor: '#000000',
    filterType: swww_1.FilterType.Lanczos3,
    transitionType: swww_1.TransitionType.simple,
    transitionStep: 90,
    transitionDuration: 3,
    transitionFPS: 60,
    transitionAngle: 45,
    transitionPositionType: 'alias',
    transitionPosition: swww_1.transitionPosition.center,
    transitionPositionIntX: 960,
    transitionPositionIntY: 540,
    transitionPositionFloatX: 0.5,
    transitionPositionFloatY: 0.5,
    invertY: false,
    transitionBezier: '.25,.1,.25,1',
    transitionWaveX: 20,
    transitionWaveY: 20
};
exports.SHORTCUT_EVENTS = {
    selectAllImagesInCurrentPage: 'selectAllImagesInCurrentPage',
    clearSelection: 'clearSelection',
    selectAllImagesInGallery: 'selectAllImagesInGallery'
};
exports.MENU_EVENTS = {
    selectAllImagesInGallery: 'selectAllImagesInGallery',
    selectAllImagesInCurrentPage: 'selectAllImagesInCurrentPage',
    clearSelectionOnCurrentPage: 'clearSelectionOnCurrentPage',
    clearSelection: 'clearSelection',
    setImagesPerPage: 'setImagesPerPage',
    addSelectedImagesToPlaylist: 'addSelectedImagesToPlaylist',
    deleteAllSelectedImages: 'deleteAllSelectedImages',
    removeSelectedImagesFromPlaylist: 'removeSelectedImagesFromPlaylist',
    deleteImageFromGallery: 'deleteImageFromGallery'
};
exports.IPC_MAIN_EVENTS = {
    updateAppConfig: 'updateAppConfig'
};
//# sourceMappingURL=constants.js.map