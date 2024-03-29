import { type BrowserWindow, type App, Menu, dialog } from 'electron';
import {
    dbOperations,
    playlistControllerInstance
} from '../database/globalConfig';
import {
    deleteImagesFromGallery,
    getMonitors,
    setImage,
    setImageAcrossAllMonitors,
    setImageExtended
} from '../appFunctions';
import { screen } from 'electron';
import { MENU_EVENTS } from '../../shared/constants';
import { type rendererImage } from '../../src/types/rendererTypes';
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
                    setImage(event, image.name, monitor.name);
                }
            };
        });
        subLabelsMonitors.unshift(
            {
                label: `Duplicate across all monitors`,
                click: () => {
                    setImage(event, image.name);
                }
            },
            {
                label: `Extend across all monitors horizontally`,
                click: () => {
                    void setImageExtended(image, monitors, 'vertical');
                }
            },
            {
                label: `Extend across all monitors vertically`,
                click: () => {
                    void setImageExtended(image, monitors, 'horizontal');
                }
            },
            {
                label: `Extend across all monitors grouping them`,
                click: () => {
                    void setImageAcrossAllMonitors(image);
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
                label: 'Add all selected images to current playlist',
                click: () => {
                    win.webContents.send(
                        MENU_EVENTS.addSelectedImagesToPlaylist
                    );
                }
            },
            {
                label: 'Delete all selected images',
                click: () => {
                    win.webContents.send(MENU_EVENTS.deleteAllSelectedImages);
                }
            }
        ];
    }
    const menu = [
        ...imagesMenu,
        {
            label: 'Images per page',
            submenu: [
                {
                    label: '20',
                    click: () => {
                        win.webContents.send(MENU_EVENTS.setImagesPerPage, 20);
                    }
                },
                {
                    label: '50',
                    click: () => {
                        win.webContents.send(MENU_EVENTS.setImagesPerPage, 50);
                    }
                },
                {
                    label: '100',
                    click: () => {
                        win.webContents.send(MENU_EVENTS.setImagesPerPage, 100);
                    }
                },
                {
                    label: '200',
                    click: () => {
                        win.webContents.send(MENU_EVENTS.setImagesPerPage, 200);
                    }
                }
            ]
        },
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
            label: 'Unselect all images in current page',
            click: () => {
                win.webContents.send(MENU_EVENTS.clearSelection);
            }
        },
        ...selectedImagesMenu
    ];
    return menu;
}
