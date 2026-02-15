/**
 * Context Menu Manager for Electron Main Process
 *
 * Handles context menu creation and actions for images and gallery.
 * Uses Go daemon API for all operations.
 */

import { Menu, BrowserWindow, dialog } from "electron";
import { goDaemonClient } from "../goDaemonClient";
import type { JsonStoreImage } from "../../shared/types/daemon";
import type { rendererImage } from "../../src/types/rendererTypes";
import { MENU_EVENTS } from "../../shared/constants";

export interface ContextMenuOptions {
	image?: rendererImage | JsonStoreImage;
	selectedImagesLength: number;
}

export class ContextMenuManager {
	/**
	 * Create and show context menu for image/gallery
	 */
	async showContextMenu(
		window: BrowserWindow,
		options: ContextMenuOptions,
	): Promise<void> {
		const { image, selectedImagesLength } = options;

		try {
			// Get monitors for image actions
			const monitors = await goDaemonClient.getMonitors();

			const menuItems: Electron.MenuItemConstructorOptions[] = [];

			// Image-specific menu items
			if (image) {
				const imageMenuItems: Electron.MenuItemConstructorOptions[] = [];

				// Set image submenu with monitor options
				const setImageSubmenu: Electron.MenuItemConstructorOptions[] = [
					{
						label: "Duplicate across all monitors",
						click: async () => {
							try {
								const allMonitors = monitors.map((m) => ({
									name: m.name,
									width: m.width,
									height: m.height,
									x: m.x,
									y: m.y,
								}));

								await goDaemonClient.setImage(image.id, image.name, {
									id: monitors.map((m) => m.name).join("_"),
									monitors: allMonitors,
									mode: "clone",
								});
							} catch (error) {
								console.error("Failed to set image across monitors:", error);
							}
						},
					},
					{
						label: "Extend across all monitors",
						click: async () => {
							try {
								const allMonitors = monitors.map((m) => ({
									name: m.name,
									width: m.width,
									height: m.height,
									x: m.x,
									y: m.y,
								}));

								await goDaemonClient.setImage(image.id, image.name, {
									id: monitors.map((m) => m.name).join("_"),
									monitors: allMonitors,
									mode: "extend",
								});
							} catch (error) {
								console.error("Failed to extend image across monitors:", error);
							}
						},
					},
					{ type: "separator" },
					...monitors.map((monitor) => ({
						label: `On ${monitor.name}`,
						click: async () => {
							try {
								await goDaemonClient.setImage(image.id, image.name, {
									id: monitor.name,
									monitors: [
										{
											name: monitor.name,
											width: monitor.width,
											height: monitor.height,
											x: monitor.x,
											y: monitor.y,
										},
									],
									mode: "individual",
								});
							} catch (error) {
								console.error(`Failed to set image on ${monitor.name}:`, error);
							}
						},
					})),
				];

				imageMenuItems.push({
					label: `Set ${image.name}`,
					submenu: setImageSubmenu,
				});

				// Delete image
				imageMenuItems.push({
					label: `Delete ${image.name}`,
					click: async () => {
						const result = await dialog.showMessageBox(window, {
							message: `Are you sure you want to delete ${image.name}?`,
							type: "question",
							buttons: ["Yes", "No"],
							title: "Confirm delete",
							defaultId: 1,
							cancelId: 1,
						});

						if (result.response === 0) {
							try {
								await goDaemonClient.deleteImages([image.id]);
								// Event will be broadcast automatically by daemon
							} catch (error) {
								console.error("Failed to delete image:", error);
								dialog.showErrorBox(
									"Delete Failed",
									`Failed to delete ${image.name}: ${error instanceof Error ? error.message : "Unknown error"}`,
								);
							}
						}
					},
				});

				menuItems.push(...imageMenuItems);
				menuItems.push({ type: "separator" });
			}

			// Selected images menu items
			if (selectedImagesLength > 0) {
				const selectedMenuItems: Electron.MenuItemConstructorOptions[] = [
					{
						label: "Add selected images to playlist",
						click: () => {
							window.webContents.send(
								MENU_EVENTS.addSelectedImagesToPlaylist,
							);
						},
					},
					{
						label: "Remove selected images from current playlist",
						click: () => {
							window.webContents.send(
								MENU_EVENTS.removeSelectedImagesFromPlaylist,
							);
						},
					},
					{
						label: "Delete selected images from gallery",
						click: async () => {
							const result = await dialog.showMessageBox(window, {
								message: `Are you sure you want to delete ${selectedImagesLength} images from the gallery?`,
								type: "question",
								buttons: ["Yes", "No"],
								title: "Confirm delete",
								defaultId: 1,
								cancelId: 1,
							});

							if (result.response === 0) {
								window.webContents.send(MENU_EVENTS.deleteAllSelectedImages);
							}
						},
					},
					{
						label: "Unselect images in current page",
						click: () => {
							window.webContents.send(
								MENU_EVENTS.clearSelectionOnCurrentPage,
							);
						},
					},
					{
						label: "Unselect all images",
						click: () => {
							window.webContents.send(MENU_EVENTS.clearSelection);
						},
					},
				];

				menuItems.push(...selectedMenuItems);
				menuItems.push({ type: "separator" });
			}

			// Always available menu items
			menuItems.push(
				{
					label: "Select all images in current page",
					click: () => {
						window.webContents.send(MENU_EVENTS.selectAllImagesInCurrentPage);
					},
				},
				{
					label: "Select all images in gallery",
					click: () => {
						window.webContents.send(MENU_EVENTS.selectAllImagesInGallery);
					},
				},
				{
					label: "Images per page",
					submenu: [
						{
							label: "20",
							click: async () => {
								window.webContents.send(MENU_EVENTS.setImagesPerPage, 20);
								try {
									await goDaemonClient.setBulkConfig({
										app: { images_per_page: 20 },
									});
								} catch (error) {
									console.error("Failed to set images per page:", error);
								}
							},
						},
						{
							label: "50",
							click: async () => {
								window.webContents.send(MENU_EVENTS.setImagesPerPage, 50);
								try {
									await goDaemonClient.setBulkConfig({
										app: { images_per_page: 50 },
									});
								} catch (error) {
									console.error("Failed to set images per page:", error);
								}
							},
						},
						{
							label: "100",
							click: async () => {
								window.webContents.send(MENU_EVENTS.setImagesPerPage, 100);
								try {
									await goDaemonClient.setBulkConfig({
										app: { images_per_page: 100 },
									});
								} catch (error) {
									console.error("Failed to set images per page:", error);
								}
							},
						},
						{
							label: "200",
							click: async () => {
								window.webContents.send(MENU_EVENTS.setImagesPerPage, 200);
								try {
									await goDaemonClient.setBulkConfig({
										app: { images_per_page: 200 },
									});
								} catch (error) {
									console.error("Failed to set images per page:", error);
								}
							},
						},
					],
				},
			);

			const menu = Menu.buildFromTemplate(menuItems);
			menu.popup({ window });
		} catch (error) {
			console.error("Failed to create context menu:", error);
		}
	}
}

export const contextMenuManager = new ContextMenuManager();

