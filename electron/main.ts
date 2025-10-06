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
import { goDaemonClient } from "./goDaemonClient";
import { devMenu, trayMenu } from "../globals/menus";
import { iconsPath, logger, values } from "../globals/setup";
import {
    type rendererImage,
    type rendererPlaylist
} from "../src/types/rendererTypes";
import { type openFileAction } from "../shared/types";
import { type DaemonSwwwConfig } from "../shared/types/daemon";
import { type ActiveMonitor } from "../shared/types/monitor";
import { PlaylistController } from "./playlistController";
import { IPC_MAIN_EVENTS } from "../shared/constants";
import { initWaypaperDaemon } from "../globals/startDaemons";
import { configReader } from "../globals/configReader";
if (values.daemon !== undefined && (values.daemon as boolean)) {
    logger.info("starting daemon...");
    (async () => {
        try {
            // Restore last wallpaper using Go daemon
            try {
                await goDaemonClient.connect();
                
                // Restore last wallpapers
                try {
                    await goDaemonClient.send("restore_last_wallpapers", {});
                    logger.info("Last wallpapers restored successfully");
                } catch (err) {
                    logger.error("Failed to restore last wallpapers:", err);
                }
                
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
        // Configuration now managed by Go daemon
        // Default behavior: show window
        win?.show();
    });
    win.on("close", () => {
        // Configuration now managed by Go daemon
        // Default behavior: close window
        // event.preventDefault();
        // win?.hide();
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
        // Converting atom:// URL to file path
        try {
            const response = await net.fetch("file://" + filePath);
            // Successfully loaded file
            return response;
        } catch (error) {
            // Failed to load file
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

        // Start watching TOML configuration file for changes
        configReader.startWatching();
        configReader.on("configChanged", (newConfig) => {
            // TOML configuration changed, notifying renderer
            win?.webContents.send("config-changed", newConfig);
        });

        // Handle thumbnail_created events from daemon
        goDaemonClient.on("thumbnail_created", (data: unknown) => {
            console.log(`🔍 Main: Received thumbnail_created event from daemon:`, data);
            console.log("🔍 Main: win is", win ? "available" : "null");
            if (win) {
                console.log("🔍 Main: Sending thumbnail_created event to renderer");
                win.webContents.send("go-daemon-event-thumbnail_created", data);
            } else {
                console.error("🔍 Main: Cannot send event - win is null");
            }
        });
        
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
        // thumbnail_created listener moved up above
        
        // Test event to verify event forwarding is working
        setTimeout(() => {
            console.log("🧪 Main: Sending test event to renderer");
            if (win) {
                win.webContents.send("go-daemon-event-test_event", { message: "test from main process" });
            }
        }, 3000);
        // Restore last wallpaper using Go daemon
        try {
            await goDaemonClient.send("restore_last_wallpapers", {});
            logger.info("Last wallpapers restored successfully via Go daemon");
        } catch (error) {
            logger.error("Failed to restore last wallpaper:", error);
        }
        createAppDirsIfNotExist();

        // Remake thumbnails using Go daemon if needed
        try {
            const cacheDir = configReader.getImagesDir();
            const thumbnailsDir = configReader.getThumbnailsDir();

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
            if (playlistControllerInstance) {
                playlistControllerInstance.stopPlaylistOnRemovedMonitors();
            }
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
app.on("quit", async () => {
    // Stop watching configuration file
    configReader.stopWatching();
    
    // Check if we should kill the daemon based on configuration
    try {
        const config = configReader.getCurrentConfig();
        if (config.app.kill_daemon_on_exit) {
            logger.info("Killing daemon on app exit as configured");
            // Always use direct approach to avoid undefined reference issues
            await goDaemonClient.killDaemon();
        } else {
            logger.info("Leaving daemon running as configured");
        }
    } catch (error) {
        logger.error("Error during app quit:", error);
    }
});

ipcMain.handle("openFiles", async (_event, action: openFileAction) => {
    return await openAndReturnImagesObject(action, win);
});
ipcMain.handle("handleOpenImages", async (_, { imagePaths, fileNames }) => {
    // Process images using Go daemon (cache directories are handled by Go daemon)
    return await goDaemonClient.sendCommand("process_images", {
        imagePaths,
        fileNames
    });
});
// These handlers are now handled by the Go daemon via go-daemon-command
ipcMain.handle("getMonitors", async () => {
    return await goDaemonClient.getMonitors();
});
// These handlers are now handled by the Go daemon via go-daemon-command
// This handler is now handled by the Go daemon via go-daemon-command
// These handlers are now handled by the Go daemon via go-daemon-command
ipcMain.handle(
    "setImage",
    async (_, image: rendererImage, activeMonitor: ActiveMonitor) => {
        // Set image using Go daemon
        try {
            await goDaemonClient.setImage(Number(image.id), activeMonitor.name);
        } catch (error) {
            logger.error("Failed to set image:", error);
        }
        void createTray();
    }
);
ipcMain.on("setRandomImage", () => {
    if (playlistControllerInstance) {
        playlistControllerInstance.randomImage();
    }
    void createTray();
});

ipcMain.on("savePlaylist", async (_, playlistObject: rendererPlaylist) => {
    // Save playlist using Go daemon
    await goDaemonClient.savePlaylist(playlistObject);
    void createTray();
});
ipcMain.on(
    "startPlaylist",
    (_event, playlist: { name: string; activeMonitor: ActiveMonitor }) => {
        if (playlistControllerInstance) {
            playlistControllerInstance.startPlaylist(playlist);
        }
        void createTray();
    }
);
ipcMain.on(
    "stopPlaylist",
    (_, playlist: { name: string; activeMonitor: ActiveMonitor }) => {
        if (playlistControllerInstance) {
            playlistControllerInstance.stopPlaylist(playlist);
        }
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
// Helper function to safely access payload properties
function getPayloadProperty<T>(payload: unknown, key: string): T | undefined {
    if (payload && typeof payload === 'object' && payload !== null && key in payload) {
        return (payload as Record<string, T>)[key];
    }
    return undefined;
}

// Type-safe payload interface
interface SafePayload {
    playlistId?: number;
    playlistName?: string;
    activeMonitor?: ActiveMonitor;
    image?: { id: number };
    filters?: unknown;
    key?: string;
    value?: unknown;
    monitors?: string[];
    fileName?: string;
    imagePaths?: string[];
    fileNames?: string[];
    monitorName?: string;
    imageIds?: number[];
}

ipcMain.handle(
    "go-daemon-command",
    async (_event, action: string, payload?: unknown) => {
        // go-daemon-command received
        try {
            const safePayload = payload as SafePayload;
            switch (action) {
                case "start_playlist":
                    return await goDaemonClient.startPlaylist(
                        getPayloadProperty<string>(safePayload, "playlistName") || "",
                        getPayloadProperty<ActiveMonitor>(safePayload, "activeMonitor") || { name: "", monitors: [], extendAcrossMonitors: false }
                    );
                case "stop_playlist":
                    return await goDaemonClient.stopPlaylist(
                        getPayloadProperty<string>(safePayload, "playlistName") || "",
                        getPayloadProperty<ActiveMonitor>(safePayload, "activeMonitor") || { name: "", monitors: [], extendAcrossMonitors: false }
                    );
                case "pause_playlist":
                    return await goDaemonClient.pausePlaylist(
                        getPayloadProperty<string>(safePayload, "playlistName") || "",
                        getPayloadProperty<ActiveMonitor>(safePayload, "activeMonitor") || { name: "", monitors: [], extendAcrossMonitors: false }
                    );
                case "resume_playlist":
                    return await goDaemonClient.resumePlaylist(
                        getPayloadProperty<string>(safePayload, "playlistName") || "",
                        getPayloadProperty<ActiveMonitor>(safePayload, "activeMonitor") || { name: "", monitors: [], extendAcrossMonitors: false }
                    );
                case "next_image":
                    return await goDaemonClient.nextImage(
                        safePayload.activeMonitor?.name || "",
                        safePayload.activeMonitor || { name: "", monitors: [], extendAcrossMonitors: false }
                    );
                case "previous_image":
                    return await goDaemonClient.previousImage(
                        safePayload.activeMonitor?.name || "",
                        safePayload.activeMonitor || { name: "", monitors: [], extendAcrossMonitors: false }
                    );
                case "random_image":
                    return await goDaemonClient.randomImage();
                case "set_image":
                    if (!safePayload.image) {
                        throw new Error("safePayload.image is undefined");
                    }
                    if (!safePayload.activeMonitor) {
                        throw new Error("safePayload.activeMonitor is undefined");
                    }
                    return await goDaemonClient.setImage(
                        safePayload.image.id,
                        safePayload.activeMonitor.name
                    );
                case "get_images":
                    return await goDaemonClient.getImages(safePayload.filters);
                case "get_playlists":
                    return await goDaemonClient.getPlaylists();
                case "get_active_playlist":
                    return await goDaemonClient.getActivePlaylist(
                        safePayload.activeMonitor || { name: "", monitors: [], extendAcrossMonitors: false }
                    );
                case "get_info":
                    return await goDaemonClient.getInfo();
                case "get_app_config":
                    return await goDaemonClient.getAppConfig();
                case "set_app_config":
                    return await goDaemonClient.setAppConfig(
                        safePayload.key || "",
                        safePayload.value
                    );
                case "get_swww_config":
                    return await goDaemonClient.getSwwwConfig();
                case "set_swww_config":
                    return await goDaemonClient.setSwwwConfig(payload as DaemonSwwwConfig);
                case "get_frontend_config":
                    return await goDaemonClient.sendCommand("get_frontend_config", {});
                case "set_frontend_config":
                    return await goDaemonClient.sendCommand("set_frontend_config", payload);
                case "restore_last_wallpapers":
                    return await goDaemonClient.sendCommand("restore_last_wallpapers", {});
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
                        safePayload.activeMonitor || { name: "", monitors: [], extendAcrossMonitors: false }
                    );
                case "get_selected_monitor":
                    return await goDaemonClient.getSelectedMonitor();
                case "next_image_all":
                    return await goDaemonClient.nextImageAll(safePayload.monitors);
                case "previous_image_all":
                    return await goDaemonClient.previousImageAll(
                        safePayload.monitors
                    );
                case "random_image_all":
                    return await goDaemonClient.randomImageAll(
                        safePayload.monitors
                    );
                case "stop_playlist_all":
                    return await goDaemonClient.stopPlaylistAll();
                case "pause_playlist_all":
                    return await goDaemonClient.pausePlaylistAll();
                case "resume_playlist_all":
                    return await goDaemonClient.resumePlaylistAll();
                case "set_image_across_monitors":
                    if (!safePayload.image) {
                        throw new Error("safePayload.image is undefined");
                    }
                    return await goDaemonClient.setImageAcrossMonitors(
                        safePayload.image.id,
                        safePayload.activeMonitor || { name: "", monitors: [], extendAcrossMonitors: false }
                    );
                case "duplicate_image_across_monitors":
                    if (!safePayload.image) {
                        throw new Error("safePayload.image is undefined");
                    }
                    return await goDaemonClient.duplicateImageAcrossMonitors(
                        safePayload.image.id,
                        safePayload.activeMonitor || { name: "", monitors: [], extendAcrossMonitors: false }
                    );
                case "process_for_monitors":
                    if (!safePayload.image) {
                        throw new Error("safePayload.image is undefined");
                    }
                    return await goDaemonClient.processForMonitors(
                        safePayload.image.id,
                        safePayload.activeMonitor || { name: "", monitors: [], extendAcrossMonitors: false }
                    );
                case "get_monitor_image":
                    const monitorImagePath =
                        await goDaemonClient.getMonitorImage(
                            safePayload.monitorName || ""
                        );
                    // Add atom:// protocol to file path for Electron
                    return monitorImagePath
                        ? `atom://${monitorImagePath}`
                        : monitorImagePath;
                case "save_playlist":
                    return await goDaemonClient.savePlaylist(payload as rendererPlaylist);
                case "delete_playlist":
                    return await goDaemonClient.deletePlaylist(
                        safePayload.playlistName || ""
                    );
                case "get_playlist_images":
                    return await goDaemonClient.getPlaylistImages(
                        safePayload.playlistId || 0
                    );
                case "delete_images_from_gallery":
                    return await goDaemonClient.deleteImagesFromGallery(
                        safePayload.imageIds || []
                    );
                case "get_diagnostics":
                    return await goDaemonClient.getDiagnostics(
                        safePayload.monitorName
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
