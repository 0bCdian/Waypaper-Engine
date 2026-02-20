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
	ActivePlaylistResponse,
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
	let activePlaylists: ActivePlaylistResponse[] = [];
	let imageHistory: ImageHistoryEntry[] = [];

	try {
		activePlaylists = (await goDaemonClient.getActivePlaylists()) || [];
		imageHistory = (await goDaemonClient.getImageHistory(10)) || [];
	} catch (error) {
		console.error("Failed to fetch tray menu data:", error);
	}

	const playlistMenu: Array<
		Electron.MenuItemConstructorOptions | Electron.MenuItem
	> = activePlaylists.length > 0
		? [
				{
					label: "Active playlists",
					submenu: activePlaylists.map((playlist) => ({
						label: `${playlist.playlist_name} on: ${playlist.monitors.map((m) => m.name).join(", ")}`,
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
							const monitor =
								entry.mode === "extend" || entry.mode === "clone"
									? "*"
									: entry.monitors[0] ?? "*";
							await goDaemonClient.setWallpaper(
								entry.image_id,
								monitor,
								entry.mode,
							);
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

	const clearHistoryMenu: Array<
		Electron.MenuItemConstructorOptions | Electron.MenuItem
	> = imageHistory.length > 0
		? [
				{
					label: "Clear history",
					click: async () => {
						try {
							await goDaemonClient.clearImageHistory();
						} catch (error) {
							console.error("Failed to clear history:", error);
						}
						if (createTray) void createTray();
					},
				},
				{ type: "separator" },
		  ]
		: [];

	const baseMenu: Array<
		Electron.MenuItemConstructorOptions | Electron.MenuItem
	> = [
		...playlistMenu,
		...imageHistoryMenu,
		...clearHistoryMenu,
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
