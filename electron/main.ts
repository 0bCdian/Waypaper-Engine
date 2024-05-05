import {
    app,
    BrowserWindow,
    ipcMain,
    protocol,
    Tray,
    Menu,
    screen,
    net
} from 'electron';
import { join } from 'node:path';
import {
    copyImagesToCacheAndProcessThumbnails,
    setImage,
    openAndReturnImagesObject,
    savePlaylist,
    deleteImagesFromGallery,
    remakeThumbnailsIfImagesExist,
    openContextMenu,
    createAppDirsIfNotExist
} from './appFunctions';
import { devMenu, trayMenu } from '../globals/menus';
import { iconsPath, values } from '../globals/setup';
import { configuration, dbOperations } from '../globals/config';
import {
    type rendererImage,
    type rendererPlaylist
} from '../src/types/rendererTypes';
import { type openFileAction } from '../shared/types';
import {
    type appConfigInsertType,
    type swwwConfigInsertType
} from '../database/schema';
import { type ActiveMonitor } from '../shared/types/monitor';
import { PlaylistController } from './playlistController';
import { IPC_MAIN_EVENTS } from '../shared/constants';
import {
    initWaypaperDaemon,
    initSwwwDaemon,
    createMainServer
} from '../globals/startDaemons';
import { getMonitors } from '../utils/monitorUtils';
import { ACTIONS } from '../types/types';
import type EventEmitter from 'node:events';
if (values.daemon !== undefined && (values.daemon as boolean)) {
    void initWaypaperDaemon();
    console.log('starting daemon...');
    process.exit(0);
}

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
process.env.DIST = join(__dirname, '../dist');
process.env.PUBLIC = app.isPackaged
    ? process.env.DIST
    : join(process.env.DIST, '../public');
process.env.NODE_ENV = app.isPackaged ? 'production' : 'development';
let tray: Tray | null = null;
let win: BrowserWindow | null;
let playlistControllerInstance: PlaylistController;
// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
async function createWindow() {
    win = new BrowserWindow({
        icon: join(iconsPath, '512x512.png'),
        width: 1200,
        height: 1000,
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
        if (configuration.app.config.startMinimized) {
            win?.hide();
        } else {
            win?.show();
        }
    });
    win.on('close', event => {
        if (configuration.app.config.minimizeInsteadOfClose) {
            event.preventDefault();
            win?.hide();
        }
    });
}
function createMenu() {
    if (!app.isPackaged) {
        const mainMenu = devMenu();
        Menu.setApplicationMenu(mainMenu);
    }
}
function registerFileProtocol() {
    protocol.handle(
        'atom',
        async request =>
            await net.fetch('file://' + request.url.slice('atom://'.length))
    );
}

async function createTray() {
    if (tray === null) {
        tray = new Tray(join(iconsPath, '512x512.png'));
        tray.setToolTip('Waypaper Engine');
        tray.on('click', () => {
            if (win !== null) {
                win.isVisible() ? win.hide() : win.show();
            }
        });
    }
    if (win === null) return;
    const trayContextMenu = await trayMenu(app, tray, createTray);
    tray.setContextMenu(trayContextMenu);
}
function registerAppServerListeners(emitter: EventEmitter) {
    emitter.on(ACTIONS.START_PLAYLIST, () => {
        void createTray();
        win?.webContents.send(IPC_MAIN_EVENTS.requeryPlaylist);
    });
    emitter.on(ACTIONS.SET_IMAGE, () => {
        void createTray();
    });
    emitter.on(ACTIONS.STOP_PLAYLIST, () => {
        void createTray();
        win?.webContents.send(IPC_MAIN_EVENTS.requeryPlaylist);
    });
    emitter.on(ACTIONS.RESUME_PLAYLIST, () => {
        void createTray();
    });
    emitter.on(ACTIONS.PAUSE_PLAYLIST, () => {
        void createTray();
    });
}
Menu.setApplicationMenu(null);
app.whenReady()
    .then(async () => {
        const server = createMainServer();
        registerAppServerListeners(server);
        initSwwwDaemon();
        await initWaypaperDaemon();
        createAppDirsIfNotExist();
        await remakeThumbnailsIfImagesExist();
        playlistControllerInstance = new PlaylistController(createTray);
        screen.on('display-added', () => {
            if (win === null) return;
            win.webContents.send(IPC_MAIN_EVENTS.displaysChanged);
        });
        screen.on('display-removed', () => {
            if (win === null) return;
            win.webContents.send(IPC_MAIN_EVENTS.displaysChanged);
            playlistControllerInstance.stopPlaylistOnRemovedMonitors();
        });
        screen.on('display-metrics-changed', () => {
            if (win === null) return;
            win.webContents.send(IPC_MAIN_EVENTS.displaysChanged);
        });
        createMenu();
        void createTray();
        dbOperations.on('updateAppConfig', () => {
            win?.webContents.send('updateAppConfig');
        });
        dbOperations.on(
            'updateAppConfig',
            (newAppConfig: appConfigInsertType) => {
                configuration.app.config = newAppConfig.config;
                playlistControllerInstance.updateConfig();
            }
        );
        dbOperations.on(
            'updateSwwwConfig',
            (newAppConfig: swwwConfigInsertType) => {
                configuration.swww.config = newAppConfig.config;
                playlistControllerInstance.updateConfig();
            }
        );
        dbOperations.on(
            'upsertPlaylist',
            (playlist: { name: string; activeMonitor: ActiveMonitor }) => {
                playlistControllerInstance.startPlaylist(playlist);
                void createTray();
            }
        );

        dbOperations.on('deletePlaylist', (playlistName: string) => {
            playlistControllerInstance.stopPlaylistByName(playlistName);
            void createTray();
        });

        dbOperations.on('updateTray', () => {
            void createTray();
        });
        registerFileProtocol();
        await createWindow();
    })
    .catch(e => {
        console.error(e);
        process.exit(1);
    });
app.on('quit', () => {
    if (configuration.app.config.killDaemon) {
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
    return dbOperations.getPlaylistImages(playlistID, null);
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
ipcMain.on(
    'setImage',
    (_, image: rendererImage, activeMonitor: ActiveMonitor) => {
        void setImage(image, activeMonitor, true);
        void createTray();
    }
);
ipcMain.on('setRandomImage', () => {
    playlistControllerInstance.randomImage();
    void createTray();
});

ipcMain.on('savePlaylist', (_, playlistObject: rendererPlaylist) => {
    savePlaylist(playlistObject);
    void createTray();
});
ipcMain.on(
    'startPlaylist',
    (_event, playlist: { name: string; activeMonitor: ActiveMonitor }) => {
        playlistControllerInstance.startPlaylist(playlist);
        void createTray();
    }
);
ipcMain.on(
    'stopPlaylist',
    (_, playlist: { name: string; activeMonitor: ActiveMonitor }) => {
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
ipcMain.on(
    'openContextMenuImage',
    (event, image: rendererImage, selectedImagesLength: number) => {
        void openContextMenu(event, image, selectedImagesLength);
    }
);

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
