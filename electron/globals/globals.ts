import { homedir } from 'node:os';
import { join } from 'node:path';
import { type BrowserWindow, type App, Menu } from 'electron';
import { type PlaylistControllerType } from '../types/types';
import { type Playlist } from '../../shared/types/playlist';
import { getActivePlaylists, getImageHistory } from '../database/dbOperations';
import { getMonitors } from '../appFunctions';
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

export const validImageExtensions = [
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

export const devMenu = ({
    win,
    app
}: {
    win: BrowserWindow | null;
    app: App;
}) => {
    const devMenu = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Quit',
                    click: () => {
                        app.exit();
                    }
                }
            ]
        },
        {
            label: 'Toggle Developer Tools',
            accelerator: (function () {
                if (process.platform === 'darwin') return 'Alt+Command+I';
                else return 'Ctrl+Shift+I';
            })(),
            click: function () {
                if (win?.isFocused() ?? false)
                    win?.webContents.toggleDevTools();
            }
        },
        {
            label: 'Reload',
            accelerator: (function () {
                if (process.platform === 'darwin') return 'Command+R';
                else return 'Ctrl+R';
            })(),
            click: function () {
                if (win?.isFocused() ?? false) win?.reload();
            }
        }
    ];
    return devMenu;
};

export const prodMenu = ({ app }: { app: App }) => {
    const prodMenu = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Quit',
                    click: () => {
                        app.exit();
                    }
                }
            ]
        }
    ];
    return prodMenu;
};

export const trayMenu = async (
    app: App,
    PlaylistController: PlaylistControllerType,
    win: BrowserWindow
) => {
    const monitors = await getMonitors();
    const playlists = getActivePlaylists();
    const monitorMenu = monitors.map(monitor => {
        const imageHistory = getImageHistory(10, monitor.name);
        const playlistActive = playlists.find(
            playlist => playlist.activePlaylists.monitor === monitor.name
        );
        return {
            label: monitor.name,
            subMenu: [
                {
                    label
                }
            ]
        };
    });
    const baseMenu = [
        {
            label: 'Random Wallpaper',
            click: () => {
                PlaylistController.randomImage();
            }
        },
        {
            type: 'separator'
        },
        {
            label: 'Quit',
            click: () => {
                app.exit();
            }
        }
    ];
};

export const trayMenuWithControls = ({
    PlaylistController,
    win,
    app
}: {
    PlaylistController: PlaylistControllerType;
    win: BrowserWindow | null;
    app: App;
}) => {
    const menuWithControls = Menu.buildFromTemplate([
        {
            label: 'Next Wallpaper',
            enabled: playlist.type === 'timer' || playlist.type === 'never',
            click: () => {
                PlaylistController.nextImage();
            }
        },
        {
            type: 'separator'
        },
        {
            label: 'Previous Wallpaper',
            enabled: playlist.type === 'timer' || playlist.type === 'never',
            click: () => {
                PlaylistController.previousImage();
            }
        },
        {
            type: 'separator'
        },
        {
            label: 'Random Wallpaper',
            click: () => {
                PlaylistController.randomImage();
            }
        },
        {
            type: 'separator'
        },
        {
            label: 'Pause Playlist',
            enabled: playlist.type === 'timer',
            click: () => {
                PlaylistController.pausePlaylist();
            }
        },
        {
            type: 'separator'
        },
        {
            label: 'Stop Playlist',
            click: () => {
                PlaylistController.stopPlaylist();
                win?.webContents.send('clearPlaylist');
            }
        },
        {
            type: 'separator'
        },
        {
            label: 'Quit',
            click: () => {
                app.exit();
            }
        }
    ]);

    return menuWithControls;
};

export const contextMenu = [
    {
        label: 'Images per page',
        submenu: [
            {
                label: '20',
                click: () => {
                    console.log('20');
                }
            },
            {
                label: '50',
                click: () => {
                    console.log('50');
                }
            },
            {
                label: '100',
                click: () => {
                    console.log('100');
                }
            },
            {
                label: '200',
                click: () => {
                    console.log('200');
                }
            }
        ]
    },
    {
        label: 'Select all images in current page',
        click: () => {
            console.log('select all images');
        }
    },
    {
        label: 'Unselect all images in current page',
        click: () => {
            console.log('unselect all images in current page');
        }
    },
    {
        label: 'Add all selected images to current playlist',
        click: () => {
            console.log('add all selected images to current playlist');
        }
    },
    {
        label: 'Delete all selected images',
        click: () => {
            console.log('delete all selected images');
        }
    }
];
