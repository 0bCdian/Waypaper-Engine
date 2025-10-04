import {
    type BrowserWindow,
    type App,
    Menu,
    dialog,
    type Tray
} from "electron";
// Database operations now handled by Go daemon
import { IPC_MAIN_EVENTS, MENU_EVENTS } from "../shared/constants";
import { type rendererImage } from "../src/types/rendererTypes";
import { type ActiveMonitor } from "../shared/types/monitor";
import { PlaylistController } from "../electron/playlistController";
import { getMonitors } from "../utils/monitorUtils";
// import { tryToSetImage } from "../utils/imageOperations"; // No longer used - image processing is now handled by Go daemon

// Helper function to set image using Go daemon
async function setImageViaGoDaemon(imageId: number, activeMonitor: ActiveMonitor) {
    const { goDaemonClient } = await import("../electron/goDaemonClient");
    
    if (activeMonitor.extendAcrossMonitors && activeMonitor.monitors.length > 1) {
        // Use multi-monitor stretch mode
        return await goDaemonClient.setImageAcrossMonitors(imageId, activeMonitor);
    } else if (activeMonitor.monitors.length > 1) {
        // Use multi-monitor duplicate mode
        return await goDaemonClient.duplicateImageAcrossMonitors(imageId, activeMonitor);
    } else {
        // Use single monitor mode
        return await goDaemonClient.setImage(imageId, activeMonitor.monitors[0].name);
    }
}

const playlistControllerInstance = new PlaylistController();
export const devMenu = () => {
    const devMenuTemplate: Array<
        Electron.MenuItemConstructorOptions | Electron.MenuItem
    > = [
        {
            label: "File",
            submenu: [
                {
                    label: "Quit",
                    role: "quit"
                }
            ]
        },
        {
            label: "Toggle Developer Tools",
            accelerator: (function () {
                if (process.platform === "darwin") return "Alt+Command+I";
                else return "Ctrl+Shift+I";
            })(),
            click: (_, win) => {
                win?.webContents.toggleDevTools();
            }
        },
        {
            label: "Reload",
            accelerator: (function () {
                if (process.platform === "darwin") return "Command+R";
                else return "Ctrl+R";
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
    // Database operations now handled by Go daemon
    const activePlaylists: any[] = [];
    const imageHistory: any[] = [];

    const playlistMenu: Array<
        Electron.MenuItemConstructorOptions | Electron.MenuItem
    > = [
        {
            label: "Active playlists",
            submenu: activePlaylists.map(playlist => {
                return {
                    label: `${playlist.Playlists.name} on: ${playlist.activePlaylists.activeMonitor.name}`,
                    submenu: [
                        {
                            label: "Next image",
                            click: () => {
                                playlistControllerInstance.nextImage({
                                    name: playlist.Playlists.name,
                                    activeMonitor:
                                        playlist.activePlaylists.activeMonitor
                                });
                                if (createTray !== undefined) void createTray();
                            },
                            enabled:
                                playlist.Playlists.type === "timer" ||
                                playlist.Playlists.type === "never"
                        },

                        {
                            label: "Previous image",
                            click: () => {
                                playlistControllerInstance.previousImage({
                                    name: playlist.Playlists.name,
                                    activeMonitor:
                                        playlist.activePlaylists.activeMonitor
                                });
                                if (createTray !== undefined) void createTray();
                            },
                            enabled:
                                playlist.Playlists.type === "timer" ||
                                playlist.Playlists.type === "never"
                        },

                        {
                            label: "Pause",
                            click: () => {
                                playlistControllerInstance.pausePlaylist({
                                    name: playlist.Playlists.name,
                                    activeMonitor:
                                        playlist.activePlaylists.activeMonitor
                                });
                            },
                            enabled: playlist.Playlists.type === "timer"
                        },
                        {
                            label: "Resume",
                            click: () => {
                                playlistControllerInstance.resumePlaylist({
                                    name: playlist.Playlists.name,
                                    activeMonitor:
                                        playlist.activePlaylists.activeMonitor
                                });
                                if (createTray !== undefined) void createTray();
                            },
                            enabled: playlist.Playlists.type === "timer"
                        },
                        {
                            label: "Stop",
                            click: (_, win) => {
                                console.log("stopping playlist");
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
            label: "Recent wallpapers",
            submenu: imageHistory.map((image, index) => {
                return {
                    label: `${index + 1}.${image.Images.name}`,
                    click: async () => {
                        try {
                            // Get the first available monitor for tray menu
                            const monitors = await getMonitors();
                            if (monitors.length > 0) {
                                const activeMonitor: ActiveMonitor = {
                                    name: monitors[0].name,
                                    monitors: [monitors[0]],
                                    extendAcrossMonitors: false
                                };
                                await setImageViaGoDaemon(image.Images.id, activeMonitor);
                                console.log(`Image ${image.Images.name} set from tray menu`);
                            }
                        } catch (error) {
                            console.error("Failed to set image from tray menu:", error);
                        }
                        void trayMenu(app, trayInstance).then(menu => {
                            trayInstance.setContextMenu(menu);
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
            label: "Random Wallpaper",
            click: () => {
                playlistControllerInstance.randomImage();
                if (createTray !== undefined) void createTray();
            }
        },
        {
            label: "Quit",
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
                click: async () => {
                    console.log(`🟠 Context Menu: Set ${image.name} on ${monitor.name}`);
                    const activeMonitor: ActiveMonitor = {
                        name: monitor.name,
                        monitors: [monitor],
                        extendAcrossMonitors: false
                    };
                    try {
                        await setImageViaGoDaemon(image.id, activeMonitor);
                        console.log(`✅ Image ${image.name} set on monitor ${monitor.name}`);
                    } catch (error) {
                        console.error("❌ Failed to set image:", error);
                    }
                }
            };
        });
        subLabelsMonitors.unshift(
            {
                label: `Duplicate across all monitors`,
                click: async () => {
                    console.log(`🟠 Context Menu: Duplicate ${image.name} across all monitors`);
                    const activeMonitor: ActiveMonitor = {
                        name: monitors.map(m => m.name).join(","),
                        monitors,
                        extendAcrossMonitors: false
                    };

                    try {
                        await setImageViaGoDaemon(image.id, activeMonitor);
                        console.log(`✅ Image ${image.name} duplicated across all monitors`);
                    } catch (error) {
                        console.error("❌ Failed to duplicate image across monitors:", error);
                    }
                }
            },
            {
                label: `Extend across all monitors grouping them`,
                click: async () => {
                    console.log(`🟠 Context Menu: Extend ${image.name} across all monitors`);
                    const activeMonitor: ActiveMonitor = {
                        name: monitors.map(m => m.name).join(","),
                        monitors,
                        extendAcrossMonitors: true
                    };
                    try {
                        await setImageViaGoDaemon(image.id, activeMonitor);
                        console.log(`✅ Image ${image.name} extended across all monitors`);
                    } catch (error) {
                        console.error("❌ Failed to extend image across monitors:", error);
                    }
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
                    console.log(`🟠 Context Menu: Delete ${image.name}`);
                    if (win === undefined) return;
                    void dialog
                        .showMessageBox(win, {
                            message: `Are you sure you want to delete ${image.name}`,
                            type: "question",
                            buttons: ["yes", "no"],
                            title: "Confirm delete"
                        })
                        .then(async data => {
                            if (data.response === 0) {
                                console.log(`✅ Deleting image: ${image.name}`);
                                try {
                                    // Delete via Go daemon
                                    const { goDaemonClient } = await import("../electron/goDaemonClient");
                                    await goDaemonClient.deleteImagesFromGallery([image.id]);
                                    
                                    // Notify frontend of successful deletion
                                    win?.webContents.send(
                                        "deleteImageFromGallery",
                                        image
                                    );
                                    console.log(`✅ Successfully deleted image: ${image.name}`);
                                } catch (error) {
                                    console.error(`❌ Failed to delete image ${image.name}:`, error);
                                }
                            } else {
                                console.log(`❌ Delete cancelled for image: ${image.name}`);
                            }
                        });
                }
            }
        ];
    }
    if (selectedImagesLength > 0) {
        selectedImagesMenu = [
            {
                label: "Add selected images to playlist",
                click: (_, win) => {
                    console.log(`🟠 Context Menu: Add ${selectedImagesLength} selected images to playlist`);
                    if (win === undefined) return;
                    win.webContents.send(
                        MENU_EVENTS.addSelectedImagesToPlaylist
                    );
                }
            },
            {
                label: "Remove selected images from current playlist",
                click: (_, win) => {
                    console.log(`🟠 Context Menu: Remove ${selectedImagesLength} selected images from current playlist`);
                    if (win === undefined) return;
                    win.webContents.send(
                        MENU_EVENTS.removeSelectedImagesFromPlaylist
                    );
                }
            },
            {
                label: "Delete selected images from gallery",
                click: (_, win) => {
                    console.log(`🟠 Context Menu: Delete ${selectedImagesLength} selected images from gallery`);
                    if (win === undefined) return;
                    void dialog
                        .showMessageBox(win, {
                            message: `Are you sure you want to delete ${selectedImagesLength} images from the gallery?`,
                            type: "question",
                            buttons: ["yes", "no"],
                            title: "Confirm delete"
                        })
                        .then(data => {
                            if (data.response === 0) {
                                console.log(`✅ Deleting ${selectedImagesLength} selected images`);
                                win.webContents.send(
                                    MENU_EVENTS.deleteAllSelectedImages
                                );
                            } else {
                                console.log(`❌ Delete cancelled for ${selectedImagesLength} selected images`);
                            }
                        });
                }
            },
            {
                label: "Unselect images in current page",
                click: (_, win) => {
                    console.log(`🟠 Context Menu: Unselect images in current page`);
                    if (win === undefined) return;
                    win.webContents.send(
                        MENU_EVENTS.clearSelectionOnCurrentPage
                    );
                }
            },
            {
                label: "Unselect all images",
                click: (_, win) => {
                    console.log(`🟠 Context Menu: Unselect all images`);
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
            label: "Select all images in current page",
            click: (_: Electron.MenuItem, win: BrowserWindow | undefined) => {
                console.log(`🟠 Context Menu: Select all images in current page`);
                if (win === undefined) return;
                win.webContents.send(MENU_EVENTS.selectAllImagesInCurrentPage);
            }
        },
        {
            label: "Select all images in gallery",
            click: (_: Electron.MenuItem, win: BrowserWindow | undefined) => {
                console.log(`🟠 Context Menu: Select all images in gallery`);
                if (win === undefined) return;
                win.webContents.send(MENU_EVENTS.selectAllImagesInGallery);
            }
        },
        {
            label: "Images per page",
            submenu: [
                {
                    label: "20",
                    click: (
                        _: Electron.MenuItem,
                        win: BrowserWindow | undefined
                    ) => {
                        console.log(`🟠 Context Menu: Set images per page to 20`);
                        if (win === undefined) return;
                        win.webContents.send(MENU_EVENTS.setImagesPerPage, 20);
                        // Database operations now handled by Go daemon
                    }
                },
                {
                    label: "50",
                    click: (
                        _: Electron.MenuItem,
                        win: BrowserWindow | undefined
                    ) => {
                        console.log(`🟠 Context Menu: Set images per page to 50`);
                        if (win === undefined) return;

                        win.webContents.send(MENU_EVENTS.setImagesPerPage, 50);
                        // Database operations now handled by Go daemon
                    }
                },
                {
                    label: "100",
                    click: (
                        _: Electron.MenuItem,
                        win: BrowserWindow | undefined
                    ) => {
                        console.log(`🟠 Context Menu: Set images per page to 100`);
                        if (win === undefined) return;
                        win.webContents.send(MENU_EVENTS.setImagesPerPage, 100);
                        // Database operations now handled by Go daemon
                    }
                },
                {
                    label: "200",
                    click: (
                        _: Electron.MenuItem,
                        win: BrowserWindow | undefined
                    ) => {
                        console.log(`🟠 Context Menu: Set images per page to 200`);
                        if (win === undefined) return;
                        win.webContents.send(MENU_EVENTS.setImagesPerPage, 200);
                        // Database operations now handled by Go daemon
                    }
                }
            ]
        }
    ];
    return menu;
}
