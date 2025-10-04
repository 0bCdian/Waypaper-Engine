import {
    app,
    BrowserWindow,
    ipcMain,
    protocol,
    Tray,
    Menu,
    screen,
    net
} from "electron";
import { join } from "node:path";
import {
    openAndReturnImagesObject,
    openContextMenu,
    createAppDirsIfNotExist
} from "./appFunctions";
import { devMenu, trayMenu } from "../globals/menus";
import { iconsPath, logger, values } from "../globals/setup";
import { configuration } from "../globals/config";
import {
    type rendererImage,
    type rendererPlaylist
} from "../src/types/rendererTypes";
import { type openFileAction } from "../shared/types";
import { type ActiveMonitor } from "../shared/types/monitor";
import { PlaylistController } from "./playlistController";
import { IPC_MAIN_EVENTS } from "../shared/constants";
import { initWaypaperDaemon } from "../globals/startDaemons";

import { getMonitors } from "../utils/monitorUtils";
import { ACTIONS } from "../types/types";
import type EventEmitter from "node:events";
if (values.daemon !== undefined && (values.daemon as boolean)) {
    logger.info("starting daemon...");
    (async () => {
        try {
            // Restore last wallpaper using Go daemon
            try {
                const { goDaemonClient } = await import("./goDaemonClient");
                await goDaemonClient.connect();
                // TODO: Implement restore last wallpaper in Go daemon
                await initWaypaperDaemon();
                process.exit(0);
            } catch (error) {
                logger.error("Failed to restore last wallpaper:", error);
                process.exit(1);
            }
        } catch (error) {
            logger.error(error);
            process.exit(1);
        }
    })();
}
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    logger.error("more than one instance running");
    app.exit(1);
} else {
    app.on("second-instance", () => {
        if (win !== null) {
            if (win.isMinimized()) win.restore();
            win.focus();
        }
    });
}
process.env.DIST = join(__dirname, "../dist");
process.env.PUBLIC = app.isPackaged
    ? process.env.DIST
    : join(process.env.DIST, "../public");
process.env.NODE_ENV = app.isPackaged ? "production" : "development";
let tray: Tray | null = null;
let win: BrowserWindow | null;
let playlistControllerInstance: PlaylistController;
// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
async function createWindow() {
    win = new BrowserWindow({
        icon: join(iconsPath, "512x512.png"),
        width: 1200,
        height: 1000,
        autoHideMenuBar: true,
        show: false,
        backgroundColor: "#3C3836",
        webPreferences: {
            preload: join(__dirname, "preload.js"),
            sandbox: false,
            nodeIntegration: true
        }
    });
    if (VITE_DEV_SERVER_URL !== undefined) {
        void win.loadURL(VITE_DEV_SERVER_URL);
    } else {
        if (process.env.DIST !== undefined) {
            void win.loadFile(join(process.env.DIST, "index.html"));
        } else {
            app.exit();
        }
    }
    win.once("ready-to-show", () => {
        if (configuration.app.config.startMinimized) {
            win?.hide();
        } else {
            win?.show();
        }
    });
    win.on("close", event => {
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
    protocol.handle("atom", async request => {
        const filePath = request.url.slice("atom://".length);
        console.log(
            "🔵 Protocol handler: Converting atom:// URL:",
            request.url,
            "to file://",
            filePath
        );
        try {
            const response = await net.fetch("file://" + filePath);
            console.log(
                "🔵 Protocol handler: Successfully loaded file:",
                filePath
            );
            return response;
        } catch (error) {
            console.error(
                "🔴 Protocol handler: Failed to load file:",
                filePath,
                "Error:",
                error
            );
            throw error;
        }
    });
}

async function createTray() {
    if (tray === null) {
        tray = new Tray(join(iconsPath, "512x512.png"));
        tray.setToolTip("Waypaper Engine");
        tray.on("click", () => {
            if (win !== null) {
                win.isVisible() ? win.hide() : win.show();
            }
        });
    }
    if (win === null) return;
    const trayContextMenu = await trayMenu(app, tray, createTray);
    tray.setContextMenu(trayContextMenu);
}
// Old socket listeners removed - now handled by Go daemon events
Menu.setApplicationMenu(null);
app.whenReady()
    .then(async () => {
        // Old socket server removed - now using Go daemon for all operations

        logger.info("About to start Go daemon...");
        await initWaypaperDaemon();
        logger.info("Go daemon started successfully");

        // Give the daemon a moment to be fully ready
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Set up Go daemon event forwarding after daemon is started
        const { goDaemonClient } = await import("./goDaemonClient");

        // Try to connect with retries
        let connected = false;
        let attempts = 0;
        const maxAttempts = 5;

        while (!connected && attempts < maxAttempts) {
            try {
                await goDaemonClient.connect();
                connected = true;
                logger.info("Successfully connected to Go daemon");
            } catch (error) {
                attempts++;
                logger.warn(
                    `Failed to connect to Go daemon (attempt ${attempts}/${maxAttempts}):`,
                    error
                );
                if (attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }

        if (!connected) {
            logger.error(
                "Failed to connect to Go daemon after maximum attempts"
            );
            process.exit(1);
        }

        // Forward Go daemon events to renderer and update tray
        goDaemonClient.on("playlist_started", data => {
            win?.webContents.send("go-daemon-event-playlist_started", data);
            void createTray();
            win?.webContents.send(IPC_MAIN_EVENTS.requeryPlaylist);
        });
        goDaemonClient.on("playlist_stopped", data => {
            win?.webContents.send("go-daemon-event-playlist_stopped", data);
            void createTray();
            win?.webContents.send(IPC_MAIN_EVENTS.requeryPlaylist);
        });
        goDaemonClient.on("playlist_paused", data => {
            win?.webContents.send("go-daemon-event-playlist_paused", data);
            void createTray();
        });
        goDaemonClient.on("playlist_resumed", data => {
            win?.webContents.send("go-daemon-event-playlist_resumed", data);
            void createTray();
        });
        goDaemonClient.on("image_changed", data => {
            win?.webContents.send("go-daemon-event-image_changed", data);
            void createTray();
        });

        // Additional events that should trigger tray updates
        goDaemonClient.on("wallpaper_changed", data => {
            win?.webContents.send("go-daemon-event-wallpaper_changed", data);
            void createTray();
        });
        goDaemonClient.on("images_updated", data => {
            win?.webContents.send("go-daemon-event-images_updated", data);
            void createTray();
            win?.webContents.send(IPC_MAIN_EVENTS.requeryPlaylist);
        });
        goDaemonClient.on("playlists_updated", data => {
            win?.webContents.send("go-daemon-event-playlists_updated", data);
            void createTray();
            win?.webContents.send(IPC_MAIN_EVENTS.requeryPlaylist);
        });
        goDaemonClient.on("config_changed", data => {
            win?.webContents.send("go-daemon-event-config_changed", data);
            void createTray();
        });

        // Forward real-time image processing events
        goDaemonClient.on("image_processed", data => {
            win?.webContents.send("go-daemon-event-image_processed", data);
        });
        goDaemonClient.on("image_error", data => {
            win?.webContents.send("go-daemon-event-image_error", data);
        });
        goDaemonClient.on("processing_complete", data => {
            win?.webContents.send("go-daemon-event-processing_complete", data);
        });
        goDaemonClient.on("wallpaper_changed", data => {
            win?.webContents.send("go-daemon-event-wallpaper_changed", data);
        });
        goDaemonClient.on("images_updated", data => {
            win?.webContents.send("go-daemon-event-images_updated", data);
        });
        goDaemonClient.on("config_changed", data => {
            win?.webContents.send("go-daemon-event-config_changed", data);
        });
        // Restore last wallpaper using Go daemon
        try {
            // TODO: Implement restore last wallpaper in Go daemon
            logger.info(
                "Last wallpaper restoration not yet implemented in Go daemon"
            );
        } catch (error) {
            logger.error("Failed to restore last wallpaper:", error);
        }
        createAppDirsIfNotExist();

        // Remake thumbnails using Go daemon if needed
        try {
            const { goDaemonClient } = await import("./goDaemonClient");
            const cacheDir = configuration.directories.imagesDir;
            const thumbnailsDir = configuration.directories.thumbnails;

            // Check if thumbnails exist, if not, recreate them
            const { readdir } = await import("node:fs/promises");
            const thumbnails = await readdir(thumbnailsDir);
            if (thumbnails.length < 1) {
                const imagesStored = await readdir(cacheDir);
                if (imagesStored.length > 0) {
                    // Process all existing images to create thumbnails
                    await goDaemonClient.sendCommand("process_images", {
                        imagePaths: imagesStored.map(img =>
                            join(cacheDir, img)
                        ),
                        fileNames: imagesStored,
                        cacheDir,
                        thumbnailsDir
                    });
                }
            }
        } catch (error) {
            logger.error("Failed to remake thumbnails:", error);
        }
        playlistControllerInstance = new PlaylistController(createTray);
        screen.on("display-added", () => {
            if (win === null) return;
            win.webContents.send(IPC_MAIN_EVENTS.displaysChanged);
        });
        screen.on("display-removed", () => {
            if (win === null) return;
            win.webContents.send(IPC_MAIN_EVENTS.displaysChanged);
            playlistControllerInstance.stopPlaylistOnRemovedMonitors();
        });
        screen.on("display-metrics-changed", () => {
            if (win === null) return;
            win.webContents.send(IPC_MAIN_EVENTS.displaysChanged);
        });
        createMenu();
        void createTray();
        // Database event listeners removed - now handled by Go daemon
        registerFileProtocol();
        await createWindow();
    })
    .catch(e => {
        logger.error(e);
        process.exit(1);
    });
app.on("quit", () => {
    if (configuration.app.config.killDaemon) {
        playlistControllerInstance.killDaemon();
    }
});

ipcMain.handle("openFiles", async (_event, action: openFileAction) => {
    return await openAndReturnImagesObject(action, win);
});
ipcMain.handle("handleOpenImages", async (_, { imagePaths, fileNames }) => {
    const { goDaemonClient } = await import("./goDaemonClient");

    // Process images using Go daemon (cache directories are handled by Go daemon)
    return await goDaemonClient.sendCommand("process_images", {
        imagePaths,
        fileNames
    });
});
// These handlers are now handled by the Go daemon via go-daemon-command
ipcMain.handle("getMonitors", async () => {
    return await getMonitors();
});
// These handlers are now handled by the Go daemon via go-daemon-command
// This handler is now handled by the Go daemon via go-daemon-command
// These handlers are now handled by the Go daemon via go-daemon-command
ipcMain.handle(
    "setImage",
    async (_, image: rendererImage, activeMonitor: ActiveMonitor) => {
        // Set image using Go daemon
        try {
            const { goDaemonClient } = await import("./goDaemonClient");
            await goDaemonClient.setImage(image.id, activeMonitor.name);
        } catch (error) {
            logger.error("Failed to set image:", error);
        }
        void createTray();
    }
);
ipcMain.on("setRandomImage", () => {
    playlistControllerInstance.randomImage();
    void createTray();
});

ipcMain.on("savePlaylist", async (_, playlistObject: rendererPlaylist) => {
    // Save playlist using Go daemon
    const { goDaemonClient } = await import("./goDaemonClient");
    await goDaemonClient.savePlaylist(playlistObject);
    void createTray();
});
ipcMain.on(
    "startPlaylist",
    (_event, playlist: { name: string; activeMonitor: ActiveMonitor }) => {
        playlistControllerInstance.startPlaylist(playlist);
        void createTray();
    }
);
ipcMain.on(
    "stopPlaylist",
    (_, playlist: { name: string; activeMonitor: ActiveMonitor }) => {
        playlistControllerInstance.stopPlaylist(playlist);
        void createTray();
    }
);
// Context menu handler for right-click on images
ipcMain.handle(
    "openContextMenuImage",
    (event, image: rendererImage, selectedImagesLength: number) => {
        return openContextMenu(event, image, selectedImagesLength);
    }
);

// Go daemon IPC handlers
ipcMain.handle(
    "go-daemon-command",
    async (_event, action: string, payload?: any) => {
        console.log(
            "🟠 Main: go-daemon-command received with action:",
            action,
            "payload:",
            payload
        );
        const { goDaemonClient } = await import("./goDaemonClient");

        try {
            switch (action) {
                case "start_playlist":
                    return await goDaemonClient.startPlaylist(
                        payload.playlistId,
                        payload.activeMonitor
                    );
                case "stop_playlist":
                    return await goDaemonClient.stopPlaylist(
                        payload.playlistName,
                        payload.activeMonitor
                    );
                case "pause_playlist":
                    return await goDaemonClient.pausePlaylist(
                        payload.playlistName,
                        payload.activeMonitor
                    );
                case "resume_playlist":
                    return await goDaemonClient.resumePlaylist(
                        payload.playlistName,
                        payload.activeMonitor
                    );
                case "next_image":
                    return await goDaemonClient.nextImage(
                        payload.activeMonitor.name,
                        payload.activeMonitor
                    );
                case "previous_image":
                    return await goDaemonClient.previousImage(
                        payload.activeMonitor.name,
                        payload.activeMonitor
                    );
                case "random_image":
                    return await goDaemonClient.randomImage();
                case "set_image":
                    if (!payload.image) {
                        throw new Error("payload.image is undefined");
                    }
                    if (!payload.activeMonitor) {
                        throw new Error("payload.activeMonitor is undefined");
                    }
                    return await goDaemonClient.setImage(
                        payload.image.id,
                        payload.activeMonitor.name
                    );
                case "get_images":
                    return await goDaemonClient.getImages(payload.filters);
                case "get_playlists":
                    return await goDaemonClient.getPlaylists();
                case "get_active_playlist":
                    return await goDaemonClient.getActivePlaylist(
                        payload.activeMonitor
                    );
                case "get_info":
                    return await goDaemonClient.getInfo();
                case "get_app_config":
                    return await goDaemonClient.getAppConfig();
                case "set_app_config":
                    return await goDaemonClient.setAppConfig(
                        payload.key,
                        payload.value
                    );
                case "get_swww_config":
                    return await goDaemonClient.getSwwwConfig();
                case "set_swww_config":
                    return await goDaemonClient.setSwwwConfig(payload);
                case "ping":
                    return await goDaemonClient.ping();
                case "get_daemon_status":
                    return await goDaemonClient.getDaemonStatus();
                case "stop_daemon":
                    return await goDaemonClient.stopDaemon();
                case "get_monitors":
                    const monitors = await goDaemonClient.getMonitors();
                    return monitors;
                case "set_selected_monitor":
                    return await goDaemonClient.setSelectedMonitor(
                        payload.activeMonitor
                    );
                case "get_selected_monitor":
                    return await goDaemonClient.getSelectedMonitor();
                case "next_image_all":
                    return await goDaemonClient.nextImageAll(payload.monitors);
                case "previous_image_all":
                    return await goDaemonClient.previousImageAll(
                        payload.monitors
                    );
                case "random_image_all":
                    return await goDaemonClient.randomImageAll(
                        payload.monitors
                    );
                case "stop_playlist_all":
                    return await goDaemonClient.stopPlaylistAll();
                case "pause_playlist_all":
                    return await goDaemonClient.pausePlaylistAll();
                case "resume_playlist_all":
                    return await goDaemonClient.resumePlaylistAll();
                case "get_image_src":
                    const imagePath = await goDaemonClient.getImageSrc(
                        payload.fileName
                    );
                    // Add atom:// protocol to file path for Electron
                    return imagePath ? `atom://${imagePath}` : imagePath;
                case "get_thumbnail_src":
                    const thumbnailPath = await goDaemonClient.getThumbnailSrc(
                        payload.fileName
                    );
                    // Add atom:// protocol to file path for Electron
                    return thumbnailPath
                        ? `atom://${thumbnailPath}`
                        : thumbnailPath;
                case "set_image_across_monitors":
                    return await goDaemonClient.setImageAcrossMonitors(
                        payload.image.id,
                        payload.activeMonitor
                    );
                case "duplicate_image_across_monitors":
                    return await goDaemonClient.duplicateImageAcrossMonitors(
                        payload.image.id,
                        payload.activeMonitor
                    );
                case "process_for_monitors":
                    return await goDaemonClient.processForMonitors(
                        payload.image.id,
                        payload.activeMonitor
                    );
                case "get_monitor_image":
                    const monitorImagePath =
                        await goDaemonClient.getMonitorImage(
                            payload.monitorName
                        );
                    // Add atom:// protocol to file path for Electron
                    return monitorImagePath
                        ? `atom://${monitorImagePath}`
                        : monitorImagePath;
                case "save_playlist":
                    return await goDaemonClient.savePlaylist(payload);
                case "delete_playlist":
                    return await goDaemonClient.deletePlaylist(
                        payload.playlistName
                    );
                case "get_playlist_images":
                    return await goDaemonClient.getPlaylistImages(
                        payload.playlistId
                    );
                case "delete_images_from_gallery":
                    return await goDaemonClient.deleteImagesFromGallery(
                        payload.imageIds
                    );
                case "get_diagnostics":
                    return await goDaemonClient.getDiagnostics(
                        payload.monitorName
                    );
                default:
                    throw new Error(`Unknown action: ${action}`);
            }
        } catch (error) {
            logger.error(`Go daemon command failed: ${action}`, error);
            throw error;
        }
    }
);

// This handler is now handled by the Go daemon via go-daemon-command
ipcMain.on("updateTray", () => {
    void createTray();
});
ipcMain.handle("exitApp", () => {
    app.exit();
});
