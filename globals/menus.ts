import {
    type BrowserWindow,
    type App,
    Menu,
    dialog,
    type Tray
} from 'electron';
import { dbOperations } from '../globals/config';
import { deleteImagesFromGallery, setImage } from '../electron/appFunctions';
// import { screen } from 'electron';
import { IPC_MAIN_EVENTS, MENU_EVENTS } from '../shared/constants';
import { type rendererImage } from '../src/types/rendererTypes';
import { type ActiveMonitor } from '../shared/types/monitor';
import { PlaylistController } from '../electron/playlistController';
import { getMonitors } from '../utils/monitorUtils';

const playlistControllerInstance = new PlaylistController();
export const devMenu = () => {
    const devMenuTemplate: Array<
        Electron.MenuItemConstructorOptions | Electron.MenuItem
    > = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Quit',
                    role: 'quit'
                }
            ]
        },
        {
            label: 'Toggle Developer Tools',
            accelerator: (function () {
                if (process.platform === 'darwin') return 'Alt+Command+I';
                else return 'Ctrl+Shift+I';
            })(),
            click: (_, win) => {
                win?.webContents.toggleDevTools();
            }
        },
        {
            label: 'Reload',
            accelerator: (function () {
                if (process.platform === 'darwin') return 'Command+R';
                else return 'Ctrl+R';
            })(),
            click: function (_, win) {
                if (win?.isFocused() ?? false) win?.reload();
            }
        }
    ];

    const devMenu = Menu.buildFromTemplate(devMenuTemplate);
    return devMenu;
};

export const trayMenu = async (
    app: App,
    trayInstance: Tray,
    createTray?: () => Promise<void>
) => {
    const activePlaylists = dbOperations.getActivePlaylists();
    const imageHistory = dbOperations.getImageHistory();

    const playlistMenu: Array<
        Electron.MenuItemConstructorOptions | Electron.MenuItem
    > = [
        {
            label: 'Active playlists',
            submenu: activePlaylists.map(playlist => {
                return {
                    label: `${playlist.Playlists.name} on: ${playlist.activePlaylists.activeMonitor.name}`,
                    submenu: [
                        {
                            label: 'Next image',
                            click: () => {
                                playlistControllerInstance.nextImage({
                                    name: playlist.Playlists.name,
                                    activeMonitor:
                                        playlist.activePlaylists.activeMonitor
                                });
                                if (createTray !== undefined) void createTray();
                            },
                            enabled:
                                playlist.Playlists.type === 'timer' ||
                                playlist.Playlists.type === 'never'
                        },

                        {
                            label: 'Previous image',
                            click: () => {
                                playlistControllerInstance.previousImage({
                                    name: playlist.Playlists.name,
                                    activeMonitor:
                                        playlist.activePlaylists.activeMonitor
                                });
                                if (createTray !== undefined) void createTray();
                            },
                            enabled:
                                playlist.Playlists.type === 'timer' ||
                                playlist.Playlists.type === 'never'
                        },

                        {
                            label: 'Pause',
                            click: () => {
                                playlistControllerInstance.pausePlaylist({
                                    name: playlist.Playlists.name,
                                    activeMonitor:
                                        playlist.activePlaylists.activeMonitor
                                });
                            },
                            enabled: playlist.Playlists.type === 'timer'
                        },
                        {
                            label: 'Resume',
                            click: () => {
                                playlistControllerInstance.resumePlaylist({
                                    name: playlist.Playlists.name,
                                    activeMonitor:
                                        playlist.activePlaylists.activeMonitor
                                });
                                if (createTray !== undefined) void createTray();
                            },
                            enabled: playlist.Playlists.type === 'timer'
                        },
                        {
                            label: 'Stop',
                            click: (_, win) => {
                                console.log('stopping playlist');
                                playlistControllerInstance.stopPlaylist({
                                    name: playlist.Playlists.name,
                                    activeMonitor:
                                        playlist.activePlaylists.activeMonitor
                                });
                                if (createTray !== undefined) void createTray();
                                win?.webContents.send(
                                    IPC_MAIN_EVENTS.clearPlaylist,
                                    {
                                        name: playlist.Playlists.name,
                                        activeMonitor:
                                            playlist.activePlaylists
                                                .activeMonitor
                                    }
                                );
                            }
                        }
                    ]
                };
            })
        }
    ];
    const imageHistoryMenu: Array<
        Electron.MenuItemConstructorOptions | Electron.MenuItem
    > = [
        {
            label: 'Recent wallpapers',
            submenu: imageHistory.map((image, index) => {
                return {
                    label: `${index + 1}.${image.Images.name}`,
                    click: () => {
                        void setImage(
                            image.Images,
                            image.imageHistory.monitor,
                            true
                        ).then(() => {
                            void trayMenu(app, trayInstance).then(menu => {
                                trayInstance.setContextMenu(menu);
                            });
                        });
                        if (createTray !== undefined) void createTray();
                    }
                };
            })
        }
    ];

    const baseMenu: Array<
        Electron.MenuItemConstructorOptions | Electron.MenuItem
    > = [
        {
            label: 'Random Wallpaper',
            click: () => {
                playlistControllerInstance.randomImage();
                if (createTray !== undefined) void createTray();
            }
        },
        {
            label: 'Quit',
            click: () => {
                app.exit();
            }
        }
    ];

    if (imageHistory.length > 0) {
        baseMenu.unshift(...imageHistoryMenu);
    }

    if (activePlaylists.length > 0) {
        baseMenu.unshift(...playlistMenu);
    }
    return Menu.buildFromTemplate(baseMenu);
};

export async function contextMenu({
    event,
    selectedImagesLength,
    image
}: {
    event: Electron.IpcMainInvokeEvent;
    selectedImagesLength: number;
    image: rendererImage | undefined;
}) {
    let imagesMenu: Array<
        Electron.MenuItemConstructorOptions | Electron.MenuItem
    > = [];
    let selectedImagesMenu: Array<
        Electron.MenuItemConstructorOptions | Electron.MenuItem
    > = [];
    if (image !== undefined) {
        const monitors = await getMonitors();
        const subLabelsMonitors = monitors.map(monitor => {
            return {
                label: `In ${monitor.name}`,
                click: () => {
                    const activeMonitor: ActiveMonitor = {
                        name: '',
                        monitors: [monitor],
                        extendAcrossMonitors: false
                    };
                    void setImage(image, activeMonitor, true);
                }
            };
        });
        subLabelsMonitors.unshift(
            {
                label: `Duplicate across all monitors`,
                click: () => {
                    const activeMonitor: ActiveMonitor = {
                        name: '',
                        monitors,
                        extendAcrossMonitors: false
                    };

                    void setImage(image, activeMonitor, true);
                }
            },
            {
                label: `Extend across all monitors grouping them`,
                click: () => {
                    const activeMonitor: ActiveMonitor = {
                        name: '',
                        monitors,
                        extendAcrossMonitors: true
                    };
                    void setImage(image, activeMonitor, true);
                }
            }
        );
        imagesMenu = [
            {
                label: `Set ${image.name}`,
                submenu: subLabelsMonitors
            },
            {
                label: `Delete ${image.name}`,
                click: (_, win) => {
                    if (win === undefined) return;
                    void dialog
                        .showMessageBox(win, {
                            message: `Are you sure you want to delete ${image.name}`,
                            type: 'question',
                            buttons: ['yes', 'no'],
                            title: 'Confirm delete'
                        })
                        .then(data => {
                            if (data.response === 0) {
                                deleteImagesFromGallery(event, [image]);
                                win?.webContents.send(
                                    'deleteImageFromGallery',
                                    image
                                );
                            }
                        });
                }
            }
        ];
    }
    if (selectedImagesLength > 0) {
        selectedImagesMenu = [
            {
                label: 'Add selected images to playlist',
                click: (_, win) => {
                    if (win === undefined) return;
                    win.webContents.send(
                        MENU_EVENTS.addSelectedImagesToPlaylist
                    );
                }
            },
            {
                label: 'Remove selected images from current playlist',
                click: (_, win) => {
                    if (win === undefined) return;
                    win.webContents.send(
                        MENU_EVENTS.removeSelectedImagesFromPlaylist
                    );
                }
            },
            {
                label: 'Delete selected images from gallery',
                click: (_, win) => {
                    if (win === undefined) return;
                    void dialog
                        .showMessageBox(win, {
                            message: `Are you sure you want to delete ${selectedImagesLength} images from the gallery?`,
                            type: 'question',
                            buttons: ['yes', 'no'],
                            title: 'Confirm delete'
                        })
                        .then(data => {
                            if (data.response === 0) {
                                win.webContents.send(
                                    MENU_EVENTS.deleteAllSelectedImages
                                );
                            }
                        });
                }
            },
            {
                label: 'Unselect images in current page',
                click: (_, win) => {
                    if (win === undefined) return;
                    win.webContents.send(
                        MENU_EVENTS.clearSelectionOnCurrentPage
                    );
                }
            },
            {
                label: 'Unselect all images',
                click: (_, win) => {
                    if (win === undefined) return;
                    win.webContents.send(MENU_EVENTS.clearSelection);
                }
            }
        ];
    }
    const menu = [
        ...imagesMenu,
        ...selectedImagesMenu,
        {
            label: 'Select all images in current page',
            click: (_: Electron.MenuItem, win: BrowserWindow | undefined) => {
                if (win === undefined) return;
                win.webContents.send(MENU_EVENTS.selectAllImagesInCurrentPage);
            }
        },
        {
            label: 'Select all images in gallery',
            click: (_: Electron.MenuItem, win: BrowserWindow | undefined) => {
                if (win === undefined) return;
                win.webContents.send(MENU_EVENTS.selectAllImagesInGallery);
            }
        },
        {
            label: 'Images per page',
            submenu: [
                {
                    label: '20',
                    click: (
                        _: Electron.MenuItem,
                        win: BrowserWindow | undefined
                    ) => {
                        if (win === undefined) return;
                        win.webContents.send(MENU_EVENTS.setImagesPerPage, 20);
                        dbOperations.updateImagesPerPage({ imagesPerPage: 20 });
                    }
                },
                {
                    label: '50',
                    click: (
                        _: Electron.MenuItem,
                        win: BrowserWindow | undefined
                    ) => {
                        if (win === undefined) return;

                        win.webContents.send(MENU_EVENTS.setImagesPerPage, 50);
                        dbOperations.updateImagesPerPage({ imagesPerPage: 50 });
                    }
                },
                {
                    label: '100',
                    click: (
                        _: Electron.MenuItem,
                        win: BrowserWindow | undefined
                    ) => {
                        if (win === undefined) return;
                        win.webContents.send(MENU_EVENTS.setImagesPerPage, 100);
                        dbOperations.updateImagesPerPage({
                            imagesPerPage: 100
                        });
                    }
                },
                {
                    label: '200',
                    click: (
                        _: Electron.MenuItem,
                        win: BrowserWindow | undefined
                    ) => {
                        if (win === undefined) return;
                        win.webContents.send(MENU_EVENTS.setImagesPerPage, 200);
                        dbOperations.updateImagesPerPage({
                            imagesPerPage: 200
                        });
                    }
                }
            ]
        }
    ];
    return menu;
}
