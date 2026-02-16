/**
 * Context Menu Manager for Electron Main Process
 *
 * Handles context menu creation and actions for images and gallery.
 * Uses Go daemon HTTP API for all operations.
 */

import { Menu, BrowserWindow, dialog } from "electron";
import { goDaemonClient } from "../goDaemonClient";
import type { Image } from "../daemon-go-types";
import { MENU_EVENTS } from "../../shared/constants";

export interface ContextMenuOptions {
	image?: Image;
	selectedImagesLength: number;
}

export class ContextMenuManager {
	async showContextMenu(
		window: BrowserWindow,
		options: ContextMenuOptions,
	): Promise<void> {
		const { image, selectedImagesLength } = options;

		try {
			const monitors = await goDaemonClient.getMonitors();
			const menuItems: Electron.MenuItemConstructorOptions[] = [];

			if (image) {
				const imageMenuItems: Electron.MenuItemConstructorOptions[] = [];

				const setImageSubmenu: Electron.MenuItemConstructorOptions[] = [
					{
						label: "Duplicate across all monitors",
						click: async () => {
							try {
								await goDaemonClient.setWallpaper(image.id, "*", "clone");
							} catch (error) {
								console.error("Failed to set image across monitors:", error);
							}
						},
					},
					{
						label: "Extend across all monitors",
						click: async () => {
							try {
								await goDaemonClient.setWallpaper(image.id, "*", "extend");
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
								await goDaemonClient.setWallpaper(
									image.id,
									monitor.name,
									"individual",
								);
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

			if (selectedImagesLength > 0) {
				menuItems.push(
					{
						label: "Add selected images to playlist",
						click: () => {
							window.webContents.send(MENU_EVENTS.addSelectedImagesToPlaylist);
						},
					},
					{
						label: "Remove selected images from current playlist",
						click: () => {
							window.webContents.send(MENU_EVENTS.removeSelectedImagesFromPlaylist);
						},
					},
					{
						label: "Delete selected images from gallery",
						click: async () => {
							const result = await dialog.showMessageBox(window, {
								message: `Are you sure you want to delete ${selectedImagesLength} images?`,
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
							window.webContents.send(MENU_EVENTS.clearSelectionOnCurrentPage);
						},
					},
					{
						label: "Unselect all images",
						click: () => {
							window.webContents.send(MENU_EVENTS.clearSelection);
						},
					},
				);
				menuItems.push({ type: "separator" });
			}

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
					submenu: [20, 50, 100, 200].map((count) => ({
						label: String(count),
						click: async () => {
							window.webContents.send(MENU_EVENTS.setImagesPerPage, count);
							try {
								await goDaemonClient.updateConfig({
									app: { images_per_page: count } as any,
								});
							} catch (error) {
								console.error("Failed to set images per page:", error);
							}
						},
					})),
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
