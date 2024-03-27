import { app, BrowserWindow, ipcMain, protocol, Tray, Menu } from 'electron';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    copyImagesToCacheAndProcessThumbnails,
    setImage,
    openAndReturnImagesObject,
    savePlaylist,
    isSwwwDaemonRunning,
    initWaypaperDaemon,
    deleteImagesFromGallery,
    remakeThumbnailsIfImagesExist,
    getMonitors,
    openContextMenu,
    openContextMenuGallery
} from './appFunctions';
import { devMenu, prodMenu, trayMenu } from './globals/menus';
import { iconPath } from './binaries';
import {
    config,
    dbOperations,
    playlistControllerInstance
} from './database/globalConfig';
import {
    type rendererImage,
    type rendererPlaylist
} from '../src/types/rendererTypes';
import { type openFileAction } from '../shared/types';
import {
    type appConfigInsertType,
    type swwwConfigInsertType
} from './database/schema';
import { createShortcuts } from './shortcuts';
import { type ActiveMonitor } from '../shared/types/monitor';
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
process.env.PUBLIC = app.isPackaged
    ? process.env.DIST
    : join(process.env.DIST, '../public');
let tray: Tray | null = null;
let win: BrowserWindow | null;
// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

async function createWindow() {
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
        if (config.app.config.startMinimized) {
            win?.hide();
        } else {
            win?.show();
        }
    });
    win.on('close', event => {
        if (config.app.config.minimizeInsteadOfClose) {
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
        const filePath = fileURLToPath(
            'file://' + request.url.slice('atom://'.length)
        );
        callback(filePath);
    });
}

async function createTray() {
    if (tray === null) {
        tray = new Tray(join(iconPath, '512x512.png'));
    }
    if (win === null) return;
    const trayContextMenu = await trayMenu(app, win);
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
        await createWindow();
        createMenu();
        void createTray();
        registerFileProtocol();
        void remakeThumbnailsIfImagesExist().then(() => {
            if (win !== null) {
                win.reload();
            }
        });
        // if (win !== null) createShortcuts(win);
    })
    .catch(e => {
        console.error(e);
    });

app.on('quit', () => {
    if (config.app.config.killDaemon) {
        playlistControllerInstance.killDaemon();
    }
});

ipcMain.handle('openFiles', async (_event, action: openFileAction) => {
    return await openAndReturnImagesObject(action, win);
});
ipcMain.handle('handleOpenImages', copyImagesToCacheAndProcessThumbnails);
ipcMain.handle('queryImages', () => {
    return dbOperations.getAllImages();
});
ipcMain.handle('queryPlaylists', () => {
    return dbOperations.getPlaylists();
});
ipcMain.handle('getPlaylistImages', async (_event, playlistID: number) => {
    return dbOperations.getPlaylistImages(playlistID);
});
ipcMain.handle('getMonitors', async () => {
    return await getMonitors();
});
ipcMain.handle('readSwwwConfig', () => {
    return dbOperations.getSwwwConfig();
});
ipcMain.handle('readAppConfig', () => {
    return dbOperations.getAppConfig();
});
ipcMain.handle('deleteImageFromGallery', deleteImagesFromGallery);
ipcMain.handle('readActivePlaylist', async (_, monitor: ActiveMonitor) => {
    return dbOperations.getActivePlaylistInfo(monitor);
});
ipcMain.handle('querySelectedMonitor', () => {
    return dbOperations.getSelectedMonitor();
});
ipcMain.on('setSelectedMonitor', (_, monitor: ActiveMonitor) => {
    dbOperations.setSelectedMonitor(monitor);
});
ipcMain.on('deletePlaylist', (_, playlistName: string) => {
    dbOperations.deletePlaylist(playlistName);
});
ipcMain.on('setImage', setImage);
ipcMain.on('savePlaylist', (_, playlistObject: rendererPlaylist) => {
    savePlaylist(playlistObject);
    void createTray();
});
ipcMain.on(
    'startPlaylist',
    (_event, playlist: { name: string; monitor: ActiveMonitor }) => {
        playlistControllerInstance.startPlaylist(playlist);
        void createTray();
    }
);
ipcMain.on(
    'stopPlaylist',
    (_, playlist: { name: string; monitor: ActiveMonitor }) => {
        playlistControllerInstance.stopPlaylist(playlist);
        void createTray();
    }
);
ipcMain.on(
    'updateSwwwConfig',
    (_, newSwwwConfig: swwwConfigInsertType['config']) => {
        dbOperations.updateSwwwConfig({ config: newSwwwConfig });
        playlistControllerInstance.updateConfig();
    }
);
ipcMain.on('openContextMenuImage', (event, image: rendererImage) => {
    if (win !== null) {
        void openContextMenu(event, image, win);
    }
});
ipcMain.on('openContextMenuGallery', () => {
    if (win !== null) {
        openContextMenuGallery();
    }
});
ipcMain.on(
    'updateAppConfig',
    (_, newAppConfig: appConfigInsertType['config']) => {
        void dbOperations.updateAppConfig({ config: newAppConfig }).then(() => {
            playlistControllerInstance.updateConfig();
        });
    }
);
ipcMain.on('updateTray', () => {
    void createTray();
});
ipcMain.on('exitApp', () => {
    app.exit();
});
