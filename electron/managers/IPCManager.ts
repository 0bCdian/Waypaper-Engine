/**
 * IPC Manager for Electron Main Process
 *
 * Centralized IPC handler management. Routes renderer requests to the
 * Go daemon HTTP client and forwards SSE events back to renderer windows.
 */

import { ipcMain, BrowserWindow, dialog, app } from "electron";
import { resolve } from "path";
import { readdir, stat } from "fs/promises";
import { join } from "path";
import { goDaemonClient } from "../goDaemonClient";
import { daemonMonitor } from "./DaemonMonitor";
import { contextMenuManager } from "./ContextMenuManager";
import type { Image } from "../daemon-go-types";

export interface IPCHandler {
	channel: string;
	handler: (
		event: Electron.IpcMainInvokeEvent,
		...args: any[]
	) => Promise<any> | any;
	description?: string;
}

export class IPCManager {
	private handlers: Map<string, IPCHandler> = new Map();
	private windows: Set<BrowserWindow> = new Set();
	private isInitialized = false;

	initialize(): void {
		if (this.isInitialized) return;

		this.setupDefaultHandlers();
		this.setupGoDaemonHandlers();
		this.setupThemeHandlers();
		this.setupWindowHandlers();
		this.setupErrorHandling();

		this.isInitialized = true;
	}

	registerWindow(window: BrowserWindow): void {
		this.windows.add(window);
	}

	unregisterWindow(window: BrowserWindow): void {
		this.windows.delete(window);
	}

	registerHandler(handler: IPCHandler): void {
		if (this.handlers.has(handler.channel)) {
			console.warn(
				`IPC handler already exists for channel: ${handler.channel}`,
			);
			return;
		}

		if (ipcMain.listenerCount(handler.channel) > 0) {
			console.warn(
				`IPC handler already registered in Electron for channel: ${handler.channel}`,
			);
			return;
		}

		this.handlers.set(handler.channel, handler);

		const unwrappedChannels = ["go-daemon-command"];

		ipcMain.handle(handler.channel, async (event, ...args) => {
			try {
				const result = await handler.handler(event, ...args);

				if (unwrappedChannels.includes(handler.channel)) {
					return result;
				}

				return { success: true, data: result };
			} catch (error) {
				console.error(`IPC error: ${handler.channel}`, error);
				return {
					success: false,
					error: error instanceof Error ? error.message : "Unknown error",
				};
			}
		});
	}

	unregisterHandler(channel: string): void {
		if (!this.handlers.has(channel)) return;
		ipcMain.removeHandler(channel);
		this.handlers.delete(channel);
	}

	// ============================================================================
	// DEFAULT HANDLERS
	// ============================================================================

	private setupDefaultHandlers(): void {
		this.registerHandler({
			channel: "ping",
			handler: async () => {
				return { message: "pong", timestamp: Date.now() };
			},
			description: "Ping-pong handler",
		});

		this.registerHandler({
			channel: "get-app-info",
			handler: async () => {
				return {
					name: "Waypaper Engine",
					version: "2.0.4",
					platform: process.platform,
					arch: process.arch,
					nodeVersion: process.version,
					electronVersion: process.versions.electron,
				};
			},
			description: "Get application information",
		});

		this.registerHandler({
			channel: "get-window-bounds",
			handler: async (event) => {
				const window = BrowserWindow.fromWebContents(event.sender);
				if (!window) return null;
				return window.getBounds();
			},
		});

		this.registerHandler({
			channel: "set-window-bounds",
			handler: async (event, bounds) => {
				const window = BrowserWindow.fromWebContents(event.sender);
				if (!window) return false;
				window.setBounds(bounds);
				return true;
			},
		});

		this.registerHandler({
			channel: "exit-app",
			handler: async () => {
				return await this.handleExitApp();
			},
		});

		this.registerHandler({
			channel: "get-daemon-status",
			handler: async () => {
				return daemonMonitor.getStatus();
			},
		});

		this.registerHandler({
			channel: "restart-daemon",
			handler: async () => {
				return await daemonMonitor.restartDaemon();
			},
		});

		this.registerHandler({
			channel: "start-daemon",
			handler: async () => {
				return await daemonMonitor.startDaemon();
			},
		});

		this.registerHandler({
			channel: "stop-daemon",
			handler: async () => {
				return await daemonMonitor.stopDaemon();
			},
		});
	}

	// ============================================================================
	// GO DAEMON HANDLERS
	// ============================================================================

	private setupGoDaemonHandlers(): void {
		this.registerHandler({
			channel: "go-daemon-command",
			handler: async (_event, action: string, payload?: unknown) => {
				return await this.handleGoDaemonCommand(action, payload);
			},
			description: "Handle Go daemon commands",
		});

		// File operations
		this.registerHandler({
			channel: "openFiles",
			handler: async (_event, action) => {
				try {
					const mainWindow = BrowserWindow.getFocusedWindow();
					if (!mainWindow) {
						return { success: false, error: "No focused window" };
					}

					let result;
					if (action === "file") {
						result = await dialog.showOpenDialog(mainWindow, {
							title: "Select Images",
							filters: [
								{
									name: "Images",
									extensions: [
										"jpg", "jpeg", "png", "gif", "bmp", "webp", "svg",
									],
								},
								{ name: "All Files", extensions: ["*"] },
							],
							properties: ["openFile", "multiSelections"],
						});
					} else if (action === "folder") {
						result = await dialog.showOpenDialog(mainWindow, {
							title: "Select Folder",
							properties: ["openDirectory"],
						});
					} else {
						return { success: false, error: "Invalid action" };
					}

					if (result.canceled || !result.filePaths?.length) {
						return { success: true, files: [] };
					}

					let files: string[] = [];

					if (action === "folder") {
						const imageExtensions = new Set([
							".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg",
						]);

						const scanDirectory = async (dirPath: string): Promise<string[]> => {
							const imageFiles: string[] = [];
							try {
								const entries = await readdir(dirPath);
								for (const entry of entries) {
									const fullPath = join(dirPath, entry);
									try {
										const stats = await stat(fullPath);
										if (stats.isDirectory()) {
											const subImages = await scanDirectory(fullPath);
											imageFiles.push(...subImages);
										} else if (stats.isFile()) {
											const ext = entry.toLowerCase().substring(entry.lastIndexOf("."));
											if (imageExtensions.has(ext)) {
												imageFiles.push(fullPath);
											}
										}
									} catch {
										// Skip inaccessible files
									}
								}
							} catch (err) {
								console.error(`Error scanning directory ${dirPath}:`, err);
							}
							return imageFiles;
						};

						for (const folderPath of result.filePaths) {
							const folderImages = await scanDirectory(folderPath);
							files.push(...folderImages);
						}
					} else {
						files = result.filePaths;
					}

					return { success: true, files };
				} catch (error) {
					console.error("Error opening files:", error);
					return {
						success: false,
						error: error instanceof Error ? error.message : "Unknown error",
					};
				}
			},
		});

		this.registerHandler({
			channel: "handleOpenImages",
			handler: async (_event, imagesObject) => {
				try {
					if (
						!imagesObject.success ||
						!imagesObject.data.files ||
						imagesObject.data.files.length === 0
					) {
						return { success: true, message: "No files to process" };
					}

					const files: string[] = imagesObject.data.files;

					// Use new POST /images endpoint with {paths}
					await goDaemonClient.importImages(files);

					return {
						success: true,
						message: `Processing ${files.length} images...`,
					};
				} catch (error) {
					console.error("Error handling open images:", error);
					return {
						success: false,
						error: error instanceof Error ? error.message : "Unknown error",
					};
				}
			},
		});

		// Setup SSE event forwarding
		this.setupGoDaemonEventForwarding();

		// Context menu
		this.setupContextMenuHandler();
	}

	private setupContextMenuHandler(): void {
		this.registerHandler({
			channel: "openContextMenu",
			handler: async (event, options: { Image?: unknown; selectedImagesLength: number }) => {
				const window = BrowserWindow.fromWebContents(event.sender);
				if (!window) {
					return { success: false, error: "Window not found" };
				}

				try {
					await contextMenuManager.showContextMenu(window, {
						image: options.Image as Image | undefined,
						selectedImagesLength: options.selectedImagesLength || 0,
					});
					return { success: true };
				} catch (error) {
					console.error("Failed to show context menu:", error);
					return {
						success: false,
						error: error instanceof Error ? error.message : "Unknown error",
					};
				}
			},
		});
	}

	// ============================================================================
	// PATH CONVERSION
	// ============================================================================

	private convertPathsToAtomProtocol(images: Image[]): Image[] {
		if (!Array.isArray(images)) return images;

		return images.map((image) => {
			if (!image || typeof image !== "object") return image;

			const converted = { ...image };

			// Convert main image path
			if (converted.path && !converted.path.startsWith("atom:")) {
				if (converted.path.startsWith("/")) {
					converted.path = `atom://${converted.path.substring(1)}`;
				} else {
					const absolutePath = resolve(converted.path);
					converted.path = `atom://${absolutePath.substring(1)}`;
				}
			}

			// Convert thumbnail paths
			if (converted.thumbnails && typeof converted.thumbnails === "object") {
				converted.thumbnails = { ...converted.thumbnails };
				for (const key of Object.keys(converted.thumbnails) as Array<
					keyof typeof converted.thumbnails
				>) {
					const thumbPath = converted.thumbnails[key];
					if (thumbPath && !thumbPath.startsWith("atom:")) {
						if (thumbPath.startsWith("/")) {
							(converted.thumbnails as any)[key] = `atom://${thumbPath.substring(1)}`;
						} else {
							const absolutePath = resolve(thumbPath);
							(converted.thumbnails as any)[key] = `atom://${absolutePath.substring(1)}`;
						}
					}
				}
			}

			return converted;
		});
	}

	// ============================================================================
	// COMMAND ROUTER
	// ============================================================================

	private async handleGoDaemonCommand(
		action: string,
		payload?: unknown,
	): Promise<unknown> {
		try {
			const p = payload as Record<string, unknown> | undefined;

			switch (action) {
				// HEALTH & SYSTEM
				case "ping":
					return await goDaemonClient.ping();
				case "get_info":
					return await goDaemonClient.getInfo();
				case "shutdown":
				case "stop_daemon":
					await goDaemonClient.shutdown();
					return { status: "shutting_down" };

				// IMAGES
				case "get_images": {
					const result = await goDaemonClient.getImages(
						p as any,
					);
					result.data = this.convertPathsToAtomProtocol(result.data);
					return result;
				}
				case "get_image":
					return await goDaemonClient.getImage(p?.id as number);
				case "get_image_count":
					return await goDaemonClient.getImageCount();
				case "import_images":
					return await goDaemonClient.importImages(
						p?.paths as string[],
					);
				case "delete_images":
					return await goDaemonClient.deleteImages(
						p?.ids as number[],
					);
				case "update_image":
					return await goDaemonClient.updateImage(
						p?.id as number,
						p?.update as any,
					);
				case "select_all_images":
					return await goDaemonClient.selectAllImages(
						p?.selected as boolean,
					);
				case "get_image_history":
					return await goDaemonClient.getImageHistory(
						p?.limit as number | undefined,
						p?.monitor as string | undefined,
					);

				// WALLPAPER
				case "set_wallpaper":
					return await goDaemonClient.setWallpaper(
						p?.image_id as number,
						(p?.monitor as string) || "*",
						(p?.mode as any) || "individual",
					);
				case "random_wallpaper":
					return await goDaemonClient.setRandomWallpaper(
						(p?.monitor as string) || "*",
						(p?.mode as any) || "individual",
					);

				// PLAYLISTS
				case "get_playlists":
					return await goDaemonClient.getPlaylists();
				case "get_playlist":
					return await goDaemonClient.getPlaylist(p?.id as number);
				case "create_playlist":
					return await goDaemonClient.createPlaylist(p as any);
				case "update_playlist":
					return await goDaemonClient.updatePlaylist(
						p?.id as number,
						p?.update as any,
					);
				case "delete_playlist":
					return await goDaemonClient.deletePlaylist(p?.id as number);
				case "start_playlist":
					return await goDaemonClient.startPlaylist(
						p?.id as number,
						(p?.monitor as string) || "*",
						(p?.mode as any) || "individual",
					);
				case "stop_playlist":
					return await goDaemonClient.stopPlaylist(p?.id as number);
				case "pause_playlist":
					return await goDaemonClient.pausePlaylist(p?.id as number);
				case "resume_playlist":
					return await goDaemonClient.resumePlaylist(p?.id as number);
				case "next_playlist_image":
					return await goDaemonClient.nextPlaylistImage(p?.id as number);
				case "previous_playlist_image":
					return await goDaemonClient.previousPlaylistImage(p?.id as number);
				case "get_active_playlists":
					return await goDaemonClient.getActivePlaylists();
				case "get_active_playlist_for_monitor":
					return await goDaemonClient.getActivePlaylistForMonitor(
						p?.monitor as string,
					);
				case "stop_all_playlists":
					return await goDaemonClient.stopAllPlaylists();
				case "pause_all_playlists":
					return await goDaemonClient.pauseAllPlaylists();
				case "resume_all_playlists":
					return await goDaemonClient.resumeAllPlaylists();

				// MONITORS
				case "get_monitors":
					return await goDaemonClient.getMonitors();
				case "get_monitor":
					return await goDaemonClient.getMonitor(p?.name as string);

				// CONFIG
				case "get_config":
					return await goDaemonClient.getConfig();
				case "update_config":
					return await goDaemonClient.updateConfig(p as any);
				case "get_config_section":
					return await goDaemonClient.getConfigSection(
						p?.section as string,
					);
				case "update_config_section":
					return await goDaemonClient.updateConfigSection(
						p?.section as string,
						p?.data as Record<string, unknown>,
					);
				case "get_backend_config":
					return await goDaemonClient.getBackendConfig();
				case "update_backend_config":
					return await goDaemonClient.updateBackendConfig(p as any);

				// BACKENDS
				case "get_backends":
					return await goDaemonClient.getBackends();
				case "activate_backend":
					return await goDaemonClient.activateBackend(
						p?.name as string,
					);

				default:
					throw new Error(`Unknown Go daemon action: ${action}`);
			}
		} catch (error) {
			console.error(`Go daemon command failed: ${action}`, error);
			throw error;
		}
	}

	// ============================================================================
	// SSE EVENT FORWARDING
	// ============================================================================

	private setupGoDaemonEventForwarding(): void {
		const events = [
			"processing_started",
			"image_processed",
			"image_error",
			"processing_complete",
			"wallpaper_changed",
			"playlist_started",
			"playlist_stopped",
			"playlist_paused",
			"playlist_resumed",
			"playlist_image_changed",
			"monitor_connected",
			"monitor_disconnected",
			"config_changed",
			"images_updated",
			"playlists_updated",
		];

		for (const eventName of events) {
			goDaemonClient.on(eventName, (data) => {
				this.broadcastToAllWindows(`go-daemon-event-${eventName}`, data);
			});
		}
	}

	// ============================================================================
	// THEME HANDLERS
	// ============================================================================

	private setupThemeHandlers(): void {
		this.registerHandler({
			channel: "get-native-theme",
			handler: async () => {
				const { nativeTheme } = require("electron");
				return {
					shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
					shouldUseHighContrastColors: nativeTheme.shouldUseHighContrastColors,
					shouldUseInvertedColorScheme:
						nativeTheme.shouldUseInvertedColorScheme,
					themeSource: nativeTheme.themeSource,
				};
			},
		});

		this.registerHandler({
			channel: "set-theme-source",
			handler: async (_event, source: "system" | "light" | "dark") => {
				const { nativeTheme } = require("electron");
				nativeTheme.themeSource = source;
				return true;
			},
		});

		this.registerHandler({
			channel: "theme-changed",
			handler: async (_event, themeName: string) => {
				this.broadcastToAllWindows("theme-changed", { themeName });
				return true;
			},
		});
	}

	// ============================================================================
	// WINDOW HANDLERS
	// ============================================================================

	private setupWindowHandlers(): void {
		this.registerHandler({
			channel: "minimize-window",
			handler: async (event) => {
				const window = BrowserWindow.fromWebContents(event.sender);
				if (!window) return false;
				window.minimize();
				return true;
			},
		});

		this.registerHandler({
			channel: "maximize-window",
			handler: async (event) => {
				const window = BrowserWindow.fromWebContents(event.sender);
				if (!window) return false;
				if (window.isMaximized()) {
					window.unmaximize();
				} else {
					window.maximize();
				}
				return true;
			},
		});

		this.registerHandler({
			channel: "close-window",
			handler: async (event) => {
				const window = BrowserWindow.fromWebContents(event.sender);
				if (!window) return false;
				window.close();
				return true;
			},
		});

		this.registerHandler({
			channel: "hide-window",
			handler: async (event) => {
				const window = BrowserWindow.fromWebContents(event.sender);
				if (!window) return false;
				window.hide();
				return true;
			},
		});

		this.registerHandler({
			channel: "show-window",
			handler: async (event) => {
				const window = BrowserWindow.fromWebContents(event.sender);
				if (!window) return false;
				window.show();
				return true;
			},
		});
	}

	// ============================================================================
	// ERROR HANDLING
	// ============================================================================

	private setupErrorHandling(): void {
		process.on("uncaughtException", (error) => {
			console.error("Uncaught Exception:", error);
			this.broadcastToAllWindows("app-error", {
				error: error.message,
				stack: error.stack,
			});
		});

		process.on("unhandledRejection", (reason, _promise) => {
			console.error("Unhandled Rejection:", reason);
			this.broadcastToAllWindows("app-error", {
				error: "Unhandled Promise Rejection",
				reason: reason?.toString(),
			});
		});
	}

	// ============================================================================
	// UTILITIES
	// ============================================================================

	private broadcastToAllWindows(channel: string, data: any): void {
		this.windows.forEach((window) => {
			if (!window.isDestroyed()) {
				window.webContents.send(channel, data);
			}
		});
	}

	getAllHandlers(): IPCHandler[] {
		return Array.from(this.handlers.values());
	}

	getHandlerCount(): number {
		return this.handlers.size;
	}

	private async handleExitApp(): Promise<boolean> {
		try {
			const config = (await goDaemonClient.getConfig()) as any;
			const shouldStopDaemon = config?.app?.kill_daemon_on_exit ?? false;

			if (shouldStopDaemon) {
				await goDaemonClient.shutdown();
			}

			this.windows.forEach((window) => {
				if (!window.isDestroyed()) {
					window.close();
				}
			});

			app.quit();
			return true;
		} catch (error) {
			console.error("Error during application exit:", error);
			app.quit();
			return false;
		}
	}

	cleanup(): void {
		this.handlers.forEach((_handler, channel) => {
			ipcMain.removeHandler(channel);
		});
		this.handlers.clear();
		this.windows.clear();
		this.isInitialized = false;
	}
}

export default IPCManager;
