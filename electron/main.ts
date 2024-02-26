import { app, BrowserWindow, ipcMain, protocol, Tray, Menu } from 'electron';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    copyImagesToCacheAndProcessThumbnails,
    setImage,
    openAndReturnImagesObject,
    savePlaylist,
    PlaylistController,
    isSwwwDaemonRunning,
    initWaypaperDaemon,
    deleteImageFromGallery,
    remakeThumbnailsIfImagesExist,
    getMonitors,
    openContextMenu
} from './appFunctions';
import dbOperations from './database/dbOperations';
import { devMenu, prodMenu, trayMenu, trayMenuWithControls } from './globals/globals';
import { iconPath } from './binaries';
import { type swwwConfig } from './database/swwwConfig';
import { type AppConfigDB } from '../src/routes/AppConfiguration';
import config from './database/globalConfig';
import { type Image, type openFileAction, type rendererPlaylist } from '../src/types/rendererTypes';

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.exit(1);
} else {
    app.on('second-instance', () => {
        if (win !== null) {
            if (win.isMinimized()) win.restore();
            win.focus();
        }
    });
}
const scriptFlag = process.argv.find(arg => {
    return arg.includes('--script');
});
if (scriptFlag !== undefined) {
    const userScriptLocation = scriptFlag.split('=')[1];
    config.script = userScriptLocation;
}
process.env.DIST = join(__dirname, '../dist');
process.env.PUBLIC = app.isPackaged ? process.env.DIST : join(process.env.DIST, '../public');
let tray: Tray | null = null;
let win: BrowserWindow | null;
// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
function createWindow() {
    win = new BrowserWindow({
        icon: join(iconPath, '512x512.png'),
        width: 1200,
        height: 1000,
        minWidth: 940,
        minHeight: 560,
        autoHideMenuBar: true,
        show: false,
        backgroundColor: '#3C3836',
        webPreferences: {
            preload: join(__dirname, 'preload.js'),
            sandbox: false,
            nodeIntegration: true
        }
    });
    if (VITE_DEV_SERVER_URL !== undefined) {
        void win.loadURL(VITE_DEV_SERVER_URL);
    } else {
        if (process.env.DIST !== undefined) {
            void win.loadFile(join(process.env.DIST, 'index.html'));
        } else {
            app.exit();
        }
    }
    win.once('ready-to-show', () => {
        if (config.app.config.startMinimized !== 0) {
            win?.hide();
        } else {
            win?.show();
        }
    });
    win.on('close', event => {
        if (config.app.config.minimizeInsteadOfClose !== 0) {
            event.preventDefault();
            win?.hide();
        }
    });
}
function createMenu() {
    const menu = app.isPackaged ? prodMenu({ app }) : devMenu({ app, win });
    const mainMenu = Menu.buildFromTemplate(menu);
    Menu.setApplicationMenu(mainMenu);
}
function registerFileProtocol() {
    protocol.registerFileProtocol('atom', (request, callback) => {
        const filePath = fileURLToPath('file://' + request.url.slice('atom://'.length));
        callback(filePath);
    });
}

function createTray() {
    if (tray === null) {
        tray = new Tray(join(iconPath, '512x512.png'));
    }
    const playlist = dbOperations.getCurrentPlaylist();
    let trayContextMenu = trayMenu(app, PlaylistController);
    if (playlist !== null) {
        trayContextMenu = trayMenuWithControls({
            PlaylistController,
            win,
            app,
            playlist,
            playlistList: dbOperations.readAllPlaylistsInDB()
        });
    }
    tray.setContextMenu(trayContextMenu);
    tray.setToolTip('Waypaper Engine');
    tray.on('click', () => {
        win?.isVisible() ?? false ? win?.hide() : win?.show();
    });
}
Menu.setApplicationMenu(null);
app.whenReady()
    .then(async () => {
        await isSwwwDaemonRunning();
        await initWaypaperDaemon();
        createWindow();
        createMenu();
        createTray();
        registerFileProtocol();
        void remakeThumbnailsIfImagesExist().then(() => {
            if (win !== null) {
                win.reload();
            }
        });
    })
    .catch(e => {
        console.error(e);
    });

app.on('quit', () => {
    if (config.app.config.killDaemon !== 0) {
        PlaylistController.killDaemon();
    }
});

ipcMain.handle('openFiles', async (_event, action: openFileAction) => {
    return await openAndReturnImagesObject(action, win);
});
ipcMain.handle('handleOpenImages', copyImagesToCacheAndProcessThumbnails);
ipcMain.handle('queryImages', () => {
    return dbOperations.readAllImagesInDB();
});
ipcMain.handle('queryPlaylists', () => {
    const playlists = dbOperations.readAllPlaylistsInDB();
    return playlists;
});
ipcMain.handle('getPlaylistImages', (_event, playlistID: number) => {
    return dbOperations.getImagesInPlaylist(playlistID);
});
ipcMain.handle('getMonitors', async () => {
    return await getMonitors();
});
ipcMain.handle('readSwwwConfig', dbOperations.readSwwwConfig.bind(dbOperations));
ipcMain.handle('readAppConfig', dbOperations.readAppConfig.bind(dbOperations));
ipcMain.handle('deleteImageFromGallery', deleteImageFromGallery);
ipcMain.handle('readActivePlaylist', () => {
    const activePlaylist = dbOperations.getCurrentPlaylist();
    if (activePlaylist !== null) {
        const playlistImages = dbOperations.getImagesInPlaylist(activePlaylist.id);
        return { ...activePlaylist, images: playlistImages };
    } else {
        return undefined;
    }
});
ipcMain.on('deletePlaylist', (_, playlistName: string) => {
    dbOperations.deletePlaylistInDB(playlistName);
    const current = dbOperations.getCurrentPlaylist();
    if (current !== null && current.name === playlistName) {
        PlaylistController.stopPlaylist();
    }
});
ipcMain.on('setImage', setImage);
ipcMain.on('savePlaylist', (_, playlistObject: rendererPlaylist) => {
    savePlaylist(playlistObject);
    dbOperations.setCurrentPlaylist(playlistObject.name);
    createTray();
});
ipcMain.on('startPlaylist', (_event, playlistName: string) => {
    dbOperations.setCurrentPlaylist(playlistName);
    PlaylistController.startPlaylist();
    createTray();
});
ipcMain.on('stopPlaylist', _ => {
    PlaylistController.stopPlaylist();
    dbOperations.setActivePlaylistToNull();
    createTray();
});
ipcMain.on('updateSwwwConfig', (_, newSwwwConfig: swwwConfig) => {
    dbOperations.updateSwwwConfig(newSwwwConfig);
    config.swww.update();
    PlaylistController.updateConfig();
});
ipcMain.on('openContextMenuImage', (event, image: Image) => {
    if (win !== null) {
        void openContextMenu(event, image, win);
    }
});
ipcMain.on('updateAppConfig', (_, newAppConfig: AppConfigDB) => {
    dbOperations.updateAppConfig(newAppConfig);
    config.app.update();
    PlaylistController.updateConfig();
});
ipcMain.on('updateTray', () => {
    createTray();
});
ipcMain.on('exitApp', () => {
    app.exit();
});
