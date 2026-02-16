import {
	type App,
	Menu,
	type Tray,
	type BrowserWindow,
} from "electron";
import { IPC_MAIN_EVENTS } from "../shared/constants";
import { PlaylistController } from "../electron/playlistController";
import { goDaemonClient } from "../electron/goDaemonClient";
import type {
	ActivePlaylistInstance,
	ImageHistoryEntry,
} from "../electron/daemon-go-types";

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
					role: "quit",
				},
			],
		},
		{
			label: "Toggle Developer Tools",
			accelerator:
				process.platform === "darwin" ? "Alt+Command+I" : "Ctrl+Shift+I",
			click: (_, win) => {
				if (win && "webContents" in win) {
					(win as BrowserWindow).webContents.toggleDevTools();
				}
			},
		},
		{
			label: "Reload",
			accelerator: process.platform === "darwin" ? "Command+R" : "Ctrl+R",
			click: (_, win) => {
				if (win && "reload" in win && (win as BrowserWindow).isFocused()) {
					(win as BrowserWindow).reload();
				}
			},
		},
	];

	return Menu.buildFromTemplate(devMenuTemplate);
};

export const trayMenu = async (
	app: App,
	trayInstance: Tray,
	createTray?: () => Promise<void>,
) => {
	let activePlaylists: Record<string, ActivePlaylistInstance> = {};
	let imageHistory: ImageHistoryEntry[] = [];

	try {
		activePlaylists = (await goDaemonClient.getActivePlaylists()) || {};
		imageHistory = (await goDaemonClient.getImageHistory(10)) || [];
	} catch (error) {
		console.error("Failed to fetch tray menu data:", error);
	}

	const playlistEntries = Object.entries(activePlaylists);

	const playlistMenu: Array<
		Electron.MenuItemConstructorOptions | Electron.MenuItem
	> = playlistEntries.length > 0
		? [
				{
					label: "Active playlists",
					submenu: playlistEntries.map(([monitor, playlist]) => ({
						label: `${playlist.playlist_name} on: ${monitor}`,
						submenu: [
							{
								label: "Next image",
								click: () => {
									playlistControllerInstance.nextImage(playlist.playlist_id);
									if (createTray) void createTray();
								},
							},
							{
								label: "Previous image",
								click: () => {
									playlistControllerInstance.previousImage(playlist.playlist_id);
									if (createTray) void createTray();
								},
							},
							{
								label: playlist.paused ? "Resume" : "Pause",
								click: () => {
									if (playlist.paused) {
										playlistControllerInstance.resumePlaylist(playlist.playlist_id);
									} else {
										playlistControllerInstance.pausePlaylist(playlist.playlist_id);
									}
									if (createTray) void createTray();
								},
							},
							{
								label: "Stop",
								click: (_, win) => {
									playlistControllerInstance.stopPlaylist(playlist.playlist_id);
									if (createTray) void createTray();
									if (win && "webContents" in win) {
										(win as BrowserWindow).webContents.send(
											IPC_MAIN_EVENTS.clearPlaylist,
											{
												playlist_id: playlist.playlist_id,
												monitor,
											},
										);
									}
								},
							},
						],
					})),
				},
		  ]
		: [];

	const imageHistoryMenu: Array<
		Electron.MenuItemConstructorOptions | Electron.MenuItem
	> = imageHistory.length > 0
		? [
				{
					label: "Recent wallpapers",
					submenu: imageHistory.map((entry, index) => ({
						label: `${index + 1}. ${entry.image_name}`,
						click: async () => {
							try {
								await goDaemonClient.setWallpaper(entry.image_id);
							} catch (error) {
								console.error("Failed to set image from tray:", error);
							}
							void trayMenu(app, trayInstance).then((menu) => {
								trayInstance.setContextMenu(menu);
							});
							if (createTray) void createTray();
						},
					})),
				},
		  ]
		: [];

	const baseMenu: Array<
		Electron.MenuItemConstructorOptions | Electron.MenuItem
	> = [
		...playlistMenu,
		...imageHistoryMenu,
		{
			label: "Random Wallpaper",
			click: () => {
				playlistControllerInstance.randomImage();
				if (createTray) void createTray();
			},
		},
		{
			label: "Quit",
			click: () => {
				app.exit();
			},
		},
	];

	return Menu.buildFromTemplate(baseMenu);
};
