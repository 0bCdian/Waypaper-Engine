import { type BrowserWindow, type App, Menu } from 'electron';
import {
    dbOperations,
    playlistControllerInstance
} from '../database/globalConfig';
import { getMonitors } from '../appFunctions';
import { screen } from 'electron';
import { MENU_EVENTS } from '../../shared/constants';
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
export function contextMenu(win: BrowserWindow, selectedImagesLength: number) {
    let selectedImagesMenu: Array<{
        label: string;
        click: () => void;
    }> = [];
    if (selectedImagesLength > 0) {
        selectedImagesMenu = [
            {
                label: 'Select all images in current page',
                click: () => {
                    win.webContents.send(
                        MENU_EVENTS.selectAllImagesInCurrentPage
                    );
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
            ],
            ...selectedImagesMenu
        }
    ];
    return menu;
}
