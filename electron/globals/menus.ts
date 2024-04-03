import { type BrowserWindow, type App, Menu, dialog } from 'electron';
import {
    dbOperations,
    playlistControllerInstance
} from '../database/globalConfig';
import {
    deleteImagesFromGallery,
    getMonitors,
    setImage
} from '../appFunctions';
import { screen } from 'electron';
import { MENU_EVENTS, IPC_MAIN_EVENTS } from '../../shared/constants';
import { type rendererImage } from '../../src/types/rendererTypes';
import { type ActiveMonitor } from '../../shared/types/monitor';
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

export const trayMenu = async (app: App, win: BrowserWindow) => {
    const monitors = await getMonitors();
    const playlists = dbOperations.getActivePlaylists();
    const allPlaylists = dbOperations.getPlaylists();
    const imageHistory = dbOperations.getImageHistory(10);
    console.log(screen.getAllDisplays());
    console.log(monitors, playlists, allPlaylists, imageHistory);
    console.log(win, app);

    const baseMenu = [
        {
            label: 'Random Wallpaper',
            click: () => {
                playlistControllerInstance.randomImage();
            }
        },
        {
            label: 'Quit',
            click: () => {
                app.exit();
            }
        }
    ];
    return Menu.buildFromTemplate(baseMenu);
};

// export const trayMenuWithControls = ({
//     PlaylistController,
//     win,
//     app
// }: {
//     win: BrowserWindow | null;
//     app: App;
// }) => {
//     const menuWithControls = Menu.buildFromTemplate([
//         {
//             label: 'Next Wallpaper',
//             enabled: playlist.type === 'timer' || playlist.type === 'never',
//             click: () => {
//                 PlaylistController.nextImage();
//             }
//         },
//         {
//             type: 'separator'
//         },
//         {
//             label: 'Previous Wallpaper',
//             enabled: playlist.type === 'timer' || playlist.type === 'never',
//             click: () => {
//                 PlaylistController.previousImage();
//             }
//         },
//         {
//             type: 'separator'
//         },
//         {
//             label: 'Random Wallpaper',
//             click: () => {
//                 PlaylistController.randomImage();
//             }
//         },
//         {
//             type: 'separator'
//         },
//         {
//             label: 'Pause Playlist',
//             enabled: playlist.type === 'timer',
//             click: () => {
//                 PlaylistController.pausePlaylist();
//             }
//         },
//         {
//             type: 'separator'
//         },
//         {
//             label: 'Stop Playlist',
//             click: () => {
//                 PlaylistController.stopPlaylist();
//                 win?.webContents.send('clearPlaylist');
//             }
//         },
//         {
//             type: 'separator'
//         },
//         {
//             label: 'Quit',
//             click: () => {
//                 app.exit();
//             }
//         }
//     ]);
//
//     return menuWithControls;
// };
//
export async function contextMenu({
    event,
    win,
    selectedImagesLength,
    image
}: {
    event: Electron.IpcMainInvokeEvent;
    win: BrowserWindow;
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
                        monitor: [monitor],
                        extendAcrossMonitors: false
                    };
                    void setImage(image, activeMonitor);
                }
            };
        });
        subLabelsMonitors.unshift(
            {
                label: `Duplicate across all monitors`,
                click: () => {
                    const activeMonitor: ActiveMonitor = {
                        name: '',
                        monitor: monitors,
                        extendAcrossMonitors: false
                    };

                    void setImage(image, activeMonitor);
                }
            },
            {
                label: `Extend across all monitors grouping them`,
                click: () => {
                    const activeMonitor: ActiveMonitor = {
                        name: '',
                        monitor: monitors,
                        extendAcrossMonitors: true
                    };
                    void setImage(image, activeMonitor);
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
                click: () => {
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
                click: () => {
                    win.webContents.send(
                        MENU_EVENTS.addSelectedImagesToPlaylist
                    );
                }
            },
            {
                label: 'Remove selected images from current playlist',
                click: () => {
                    win.webContents.send(
                        MENU_EVENTS.removeSelectedImagesFromPlaylist
                    );
                }
            },
            {
                label: 'Delete selected images from gallery',
                click: () => {
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
                click: () => {
                    win.webContents.send(
                        MENU_EVENTS.clearSelectionOnCurrentPage
                    );
                }
            },
            {
                label: 'Unselect all images',
                click: () => {
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
            click: () => {
                win.webContents.send(MENU_EVENTS.selectAllImagesInCurrentPage);
            }
        },
        {
            label: 'Select all images in gallery',
            click: () => {
                win.webContents.send(MENU_EVENTS.selectAllImagesInGallery);
            }
        },
        {
            label: 'Images per page',
            submenu: [
                {
                    label: '20',
                    click: () => {
                        win.webContents.send(MENU_EVENTS.setImagesPerPage, 20);
                        dbOperations.updateImagesPerPage({ imagesPerPage: 20 });
                    }
                },
                {
                    label: '50',
                    click: () => {
                        win.webContents.send(MENU_EVENTS.setImagesPerPage, 50);
                        dbOperations.updateImagesPerPage({ imagesPerPage: 50 });
                    }
                },
                {
                    label: '100',
                    click: () => {
                        win.webContents.send(MENU_EVENTS.setImagesPerPage, 100);
                        dbOperations.updateImagesPerPage({
                            imagesPerPage: 100
                        });
                    }
                },
                {
                    label: '200',
                    click: () => {
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
