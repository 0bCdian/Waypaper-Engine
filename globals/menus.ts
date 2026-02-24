import {
	type App,
	Menu,
	type Tray,
	type BrowserWindow,
} from "electron";
import { IPC_MAIN_EVENTS } from "../shared/constants";
import { goDaemonClient } from "../electron/goDaemonClient";
import type {
	ActivePlaylistInstance,
	ImageHistoryEntry,
} from "../electron/daemon-go-types";

async function safeCall(fn: () => Promise<unknown>, label: string) {
	try {
		await fn();
	} catch (error) {
		console.error(`Failed to ${label}:`, error);
	}
}

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
	let activePlaylists: ActivePlaylistInstance[] = [];
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
						label: `${playlist.playlist_name} on: ${playlist.monitors.join(", ")}`,
						submenu: [
							{
							label: "Next image",
							click: () => {
								void safeCall(() => goDaemonClient.nextPlaylistImage(playlist.playlist_id), "get next image");
								if (createTray) void createTray();
							},
							},
							{
							label: "Previous image",
							click: () => {
								void safeCall(() => goDaemonClient.previousPlaylistImage(playlist.playlist_id), "get previous image");
								if (createTray) void createTray();
							},
							},
							{
								label: playlist.paused ? "Resume" : "Pause",
							click: () => {
								if (playlist.paused) {
									void safeCall(() => goDaemonClient.resumePlaylist(playlist.playlist_id), "resume playlist");
								} else {
									void safeCall(() => goDaemonClient.pausePlaylist(playlist.playlist_id), "pause playlist");
								}
								if (createTray) void createTray();
							},
							},
							{
								label: "Stop",
							click: (_, win) => {
								void safeCall(() => goDaemonClient.stopPlaylist(playlist.playlist_id), "stop playlist");
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
			void safeCall(() => goDaemonClient.setRandomWallpaper(), "set random wallpaper");
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
