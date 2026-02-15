import {
	type App,
	Menu,
	dialog,
	type Tray,
	type BrowserWindow,
} from "electron";
// Database operations now handled by Go daemon
import { IPC_MAIN_EVENTS, MENU_EVENTS } from "../shared/constants";
import { type rendererImage } from "../src/types/rendererTypes";
import { type ActiveMonitor } from "../shared/types/monitor";
import { PlaylistController } from "../electron/playlistController";
import { configManager } from "../shared/configManager";
import { goDaemonClient } from "../electron/goDaemonClient";
import type {
	DaemonActivePlaylist,
	DaemonImageHistory,
	DaemonMonitor,
} from "../shared/types/daemon";
import type { Monitor } from "../shared/types/monitor";

// Helper function to set image using Go daemon
async function setImageViaGoDaemon(
	imageId: number,
	activeMonitor: ActiveMonitor,
) {
	if (activeMonitor.extendAcrossMonitors && activeMonitor.monitors.length > 1) {
		// Use multi-monitor stretch mode
		return await goDaemonClient.setImageAcrossMonitors(imageId, activeMonitor);
	} else if (activeMonitor.monitors.length > 1) {
		// Use multi-monitor duplicate mode
		return await goDaemonClient.duplicateImageAcrossMonitors(
			imageId,
			activeMonitor,
		);
	} else {
		// Use single monitor mode
		return await goDaemonClient.setImage(
			imageId,
			activeMonitor,
		);
	}
}

const playlistControllerInstance = new PlaylistController();

// Helper function to create ActiveMonitor from playlist data
function createActiveMonitorFromPlaylist(
	playlist: DaemonActivePlaylist,
): ActiveMonitor {
	return {
		name: playlist.activeMonitorName,
		monitors: [
			{
				name: playlist.activeMonitorName,
				width: 1920,
				height: 1080,
				currentImage: "",
				position: { x: 0, y: 0 },
			},
		],
		extendAcrossMonitors: false,
	};
}

// Helper function to convert DaemonMonitor to Monitor
function convertDaemonMonitorToMonitor(daemonMonitor: DaemonMonitor): Monitor {
	return {
		name: daemonMonitor.name,
		width: daemonMonitor.width,
		height: daemonMonitor.height,
		currentImage: daemonMonitor.currentImage || "",
		position: daemonMonitor.position,
	};
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
			accelerator: (function () {
				if (process.platform === "darwin") return "Alt+Command+I";
				else return "Ctrl+Shift+I";
			})(),
			click: (_, win) => {
				if (
					win &&
					typeof win === "object" &&
					win !== null &&
					"webContents" in win
				) {
					(win as BrowserWindow).webContents.toggleDevTools();
				}
			},
		},
		{
			label: "Reload",
			accelerator: (function () {
				if (process.platform === "darwin") return "Command+R";
				else return "Ctrl+R";
			})(),
			click: function (_, win) {
				if (
					win &&
					"reload" in win &&
					"isFocused" in win &&
					(win as BrowserWindow).isFocused()
				) {
					(win as BrowserWindow).reload();
				}
			},
		},
	];

	const devMenu = Menu.buildFromTemplate(devMenuTemplate);
	return devMenu;
};

export const trayMenu = async (
	app: App,
	trayInstance: Tray,
	createTray?: () => Promise<void>,
) => {
	// Fetch data from Go daemon
	let activePlaylists: DaemonActivePlaylist[] = [];
	let imageHistory: DaemonImageHistory[] = [];

	try {
		// Get active playlists from daemon
		activePlaylists = (await goDaemonClient.getActivePlaylists()) as DaemonActivePlaylist[] || [];

		// Get image history from daemon
		imageHistory = (await goDaemonClient.getImageHistory()) || [];
	} catch (error) {
		console.error("Failed to fetch tray menu data:", error);
		// Fallback to empty arrays if daemon is unavailable
		activePlaylists = [];
		imageHistory = [];
	}

	const playlistMenu: Array<
		Electron.MenuItemConstructorOptions | Electron.MenuItem
	> = [
		{
			label: "Active playlists",
			submenu: activePlaylists.map((playlist: DaemonActivePlaylist) => {
				return {
					label: `${playlist.name} on: ${playlist.activeMonitorName}`,
					submenu: [
						{
							label: "Next image",
							click: () => {
								playlistControllerInstance.nextImage({
									name: playlist.name,
									activeMonitor: createActiveMonitorFromPlaylist(playlist),
								});
								if (createTray !== undefined) void createTray();
							},
							enabled: playlist.type === "timer" || playlist.type === "never",
						},

						{
							label: "Previous image",
							click: () => {
								playlistControllerInstance.previousImage({
									name: playlist.name,
									activeMonitor: createActiveMonitorFromPlaylist(playlist),
								});
								if (createTray !== undefined) void createTray();
							},
							enabled: playlist.type === "timer" || playlist.type === "never",
						},

						{
							label: "Pause",
							click: () => {
								playlistControllerInstance.pausePlaylist({
									name: playlist.name,
									activeMonitor: createActiveMonitorFromPlaylist(playlist),
								});
							},
							enabled: playlist.type === "timer",
						},
						{
							label: "Resume",
							click: () => {
								playlistControllerInstance.resumePlaylist({
									name: playlist.name,
									activeMonitor: createActiveMonitorFromPlaylist(playlist),
								});
								if (createTray !== undefined) void createTray();
							},
							enabled: playlist.type === "timer",
						},
						{
							label: "Stop",
							click: (_, win) => {
								// Stopping playlist
								const activeMonitor = createActiveMonitorFromPlaylist(playlist);
								playlistControllerInstance.stopPlaylist({
									name: playlist.name,
									activeMonitor: activeMonitor,
								});
								if (createTray !== undefined) void createTray();
								if (
									win &&
									typeof win === "object" &&
									win !== null &&
									"webContents" in win
								) {
									(win as BrowserWindow).webContents.send(
										IPC_MAIN_EVENTS.clearPlaylist,
										{
											name: playlist.name,
											activeMonitor: activeMonitor,
										},
									);
								}
							},
						},
					],
				};
			}),
		},
	];
	const imageHistoryMenu: Array<
		Electron.MenuItemConstructorOptions | Electron.MenuItem
	> = [
		{
			label: "Recent wallpapers",
			submenu: imageHistory.map((image: DaemonImageHistory, index: number) => {
				return {
					label: `${index + 1}. ${image.name}`,
					click: async () => {
						try {
							// Get the first available monitor for tray menu
							const monitors = await goDaemonClient.getMonitors();
							if (monitors.length > 0) {
								const activeMonitor: ActiveMonitor = {
									name: monitors[0].name,
									monitors: [convertDaemonMonitorToMonitor(monitors[0])],
									extendAcrossMonitors: false,
								};
								await setImageViaGoDaemon(image.id, activeMonitor);
								`✅ Image set from tray menu: ${image.name}`;
							}
						} catch (error) {
							console.error(
								`❌ Failed to set image from tray menu: ${image.name}`,
								error,
							);
						}
						void trayMenu(app, trayInstance).then((menu) => {
							trayInstance.setContextMenu(menu);
						});
						if (createTray !== undefined) void createTray();
					},
				};
			}),
		},
	];

	const baseMenu: Array<
		Electron.MenuItemConstructorOptions | Electron.MenuItem
	> = [
		{
			label: "Random Wallpaper",
			click: () => {
				playlistControllerInstance.randomImage({
					name: "default",
					monitors: [],
					extendAcrossMonitors: false,
					imageSetType: "individual"
				});
				if (createTray !== undefined) void createTray();
			},
		},
		{
			label: "Quit",
			click: () => {
				app.exit();
			},
		},
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
	selectedImagesLength,
	image,
}: {
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
		const monitors = await goDaemonClient.getMonitors();
		const subLabelsMonitors = monitors.map((monitor: DaemonMonitor) => {
			return {
				label: `In ${monitor.name}`,
				click: async () => {
					// Context Menu: Set image on monitor
					const activeMonitor: ActiveMonitor = {
						name: monitor.name,
						monitors: [convertDaemonMonitorToMonitor(monitor)],
						extendAcrossMonitors: false,
					};
					try {
						await setImageViaGoDaemon(image.id, activeMonitor);
						// Image set on monitor
					} catch (error) {
						// Failed to set image
					}
				},
			};
		});
		subLabelsMonitors.unshift(
			{
				label: `Duplicate across all monitors`,
				click: async () => {
					// Context Menu: Duplicate image across all monitors
					const activeMonitor: ActiveMonitor = {
						name: monitors.map((m: DaemonMonitor) => m.name).join(","),
						monitors: monitors.map(convertDaemonMonitorToMonitor),
						extendAcrossMonitors: false,
					};

					try {
						await setImageViaGoDaemon(image.id, activeMonitor);
						// Image duplicated across all monitors
					} catch (error) {
						// Failed to duplicate image across monitors
					}
				},
			},
			{
				label: `Extend across all monitors grouping them`,
				click: async () => {
					// Context Menu: Extend image across all monitors
					const activeMonitor: ActiveMonitor = {
						name: monitors.map((m: DaemonMonitor) => m.name).join(","),
						monitors: monitors.map(convertDaemonMonitorToMonitor),
						extendAcrossMonitors: true,
					};
					try {
						await setImageViaGoDaemon(image.id, activeMonitor);
						// Image extended across all monitors
					} catch (error) {
						// Failed to extend image across monitors
					}
				},
			},
		);
		imagesMenu = [
			{
				label: `Set ${image.name}`,
				submenu: subLabelsMonitors,
			},
			{
				label: `Delete ${image.name}`,
				click: (_, win) => {
					// Context Menu: Delete image
					if (win === undefined) return;
					void dialog
						.showMessageBox(win as BrowserWindow, {
							message: `Are you sure you want to delete ${image.name}`,
							type: "question",
							buttons: ["yes", "no"],
							title: "Confirm delete",
						})
						.then(async (data) => {
							if (data.response === 0) {
								// Deleting image
								try {
									// Delete via Go daemon
									await goDaemonClient.deleteImagesFromGallery([image.id]);

									// Notify frontend of successful deletion
									if (
										win &&
										typeof win === "object" &&
										win !== null &&
										"webContents" in win
									) {
										(win as BrowserWindow).webContents.send(
											"deleteImageFromGallery",
											image,
										);
									}
									`✅ Successfully deleted image: ${image.name}`;
								} catch (error) {
									console.error(
										`❌ Failed to delete image ${image.name}:`,
										error,
									);
								}
							} else {
								`❌ Delete cancelled for image: ${image.name}`;
							}
						});
				},
			},
		];
	}
	if (selectedImagesLength > 0) {
		selectedImagesMenu = [
			{
				label: "Add selected images to playlist",
				click: (_, win) => {
					`🟠 Context Menu: Add ${selectedImagesLength} selected images to playlist`;
					if (
						win &&
						typeof win === "object" &&
						win !== null &&
						"webContents" in win
					) {
						(win as BrowserWindow).webContents.send(
							MENU_EVENTS.addSelectedImagesToPlaylist,
						);
					}
				},
			},
			{
				label: "Remove selected images from current playlist",
				click: (_, win) => {
					`🟠 Context Menu: Remove ${selectedImagesLength} selected images from current playlist`;
					if (
						win &&
						typeof win === "object" &&
						win !== null &&
						"webContents" in win
					) {
						(win as BrowserWindow).webContents.send(
							MENU_EVENTS.removeSelectedImagesFromPlaylist,
						);
					}
				},
			},
			{
				label: "Delete selected images from gallery",
				click: (_, win) => {
					`🟠 Context Menu: Delete ${selectedImagesLength} selected images from gallery`;
					void dialog
						.showMessageBox(win as BrowserWindow, {
							message: `Are you sure you want to delete ${selectedImagesLength} images from the gallery?`,
							type: "question",
							buttons: ["yes", "no"],
							title: "Confirm delete",
						})
						.then((data) => {
							if (data.response === 0) {
								`✅ Deleting ${selectedImagesLength} selected images`;
								if (
									win &&
									typeof win === "object" &&
									win !== null &&
									"webContents" in win
								) {
									(win as BrowserWindow).webContents.send(
										MENU_EVENTS.deleteAllSelectedImages,
									);
								}
							} else {
								`❌ Delete cancelled for ${selectedImagesLength} selected images`;
							}
						});
				},
			},
			{
				label: "Unselect images in current page",
				click: (_, win) => {
					`🟠 Context Menu: Unselect images in current page`;
					if (
						win &&
						typeof win === "object" &&
						win !== null &&
						"webContents" in win
					) {
						(win as BrowserWindow).webContents.send(
							MENU_EVENTS.clearSelectionOnCurrentPage,
						);
					}
				},
			},
			{
				label: "Unselect all images",
				click: (_, win) => {
					`🟠 Context Menu: Unselect all images`;
					if (
						win &&
						typeof win === "object" &&
						win !== null &&
						"webContents" in win
					) {
						(win as BrowserWindow).webContents.send(MENU_EVENTS.clearSelection);
					}
				},
			},
		];
	}
	const menu = [
		...imagesMenu,
		...selectedImagesMenu,
		{
			label: "Select all images in current page",
			click: (_: unknown, win: unknown) => {
				`🟠 Context Menu: Select all images in current page`;
				if (
					win &&
					typeof win === "object" &&
					win !== null &&
					"webContents" in win
				) {
					(win as BrowserWindow).webContents.send(
						MENU_EVENTS.selectAllImagesInCurrentPage,
					);
				}
			},
		},
		{
			label: "Select all images in gallery",
			click: (_: unknown, win: unknown) => {
				`🟠 Context Menu: Select all images in gallery`;
				if (
					win &&
					typeof win === "object" &&
					win !== null &&
					"webContents" in win
				) {
					(win as BrowserWindow).webContents.send(
						MENU_EVENTS.selectAllImagesInGallery,
					);
				}
			},
		},
		{
			label: "Images per page",
			submenu: [
				{
					label: "20",
					click: async (_: unknown, win: unknown) => {
						`🟠 Context Menu: Set images per page to 20`;
						try {
							await configManager.updateConfig({
								app: { images_per_page: 20 } as any,
							});
							if (
								win &&
								typeof win === "object" &&
								win !== null &&
								"webContents" in win
							) {
								(win as BrowserWindow).webContents.send(
									MENU_EVENTS.setImagesPerPage,
									20,
								);
							}
						} catch (error) {
							console.error("Failed to update images per page config:", error);
						}
					},
				},
				{
					label: "50",
					click: async (_: unknown, win: unknown) => {
						`🟠 Context Menu: Set images per page to 50`;
						try {
							await configManager.updateConfig({
								app: { images_per_page: 50 } as any,
							});
							if (
								win &&
								typeof win === "object" &&
								win !== null &&
								"webContents" in win
							) {
								(win as BrowserWindow).webContents.send(
									MENU_EVENTS.setImagesPerPage,
									50,
								);
							}
						} catch (error) {
							console.error("Failed to update images per page config:", error);
						}
					},
				},
				{
					label: "100",
					click: async (_: unknown, win: unknown) => {
						`🟠 Context Menu: Set images per page to 100`;
						try {
							await configManager.updateConfig({
								app: { images_per_page: 100 } as any,
							});
							if (
								win &&
								typeof win === "object" &&
								win !== null &&
								"webContents" in win
							) {
								(win as BrowserWindow).webContents.send(
									MENU_EVENTS.setImagesPerPage,
									100,
								);
							}
						} catch (error) {
							console.error("Failed to update images per page config:", error);
						}
					},
				},
				{
					label: "200",
					click: async (_: unknown, win: unknown) => {
						`🟠 Context Menu: Set images per page to 200`;
						try {
							await configManager.updateConfig({
								app: { images_per_page: 200 } as any,
							});
							if (
								win &&
								typeof win === "object" &&
								win !== null &&
								"webContents" in win
							) {
								(win as BrowserWindow).webContents.send(
									MENU_EVENTS.setImagesPerPage,
									200,
								);
							}
						} catch (error) {
							console.error("Failed to update images per page config:", error);
						}
					},
				},
			],
		},
	];
	return menu;
}
