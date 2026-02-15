/**
 * IPC Manager for Electron Main Process
 *
 * Centralized IPC handler management for better organization and error handling.
 */

import { ipcMain, BrowserWindow, dialog, app } from "electron";
import { resolve } from "path";
import { readdir, stat } from "fs/promises";
import { join } from "path";
import { goDaemonClient } from "../goDaemonClient";
import { daemonMonitor } from "./DaemonMonitor";
import { contextMenuManager } from "./ContextMenuManager";
import type { JsonStoreImage, DaemonPlaylist, DaemonMonitor } from "../../shared/types/daemon";

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

	/**
	 * Initialize the IPC manager
	 */
	initialize(): void {
		if (this.isInitialized) return;

		this.setupDefaultHandlers();
		this.setupGoDaemonHandlers();
		this.setupThemeHandlers();
		this.setupWindowHandlers();
		this.setupErrorHandling();

		this.isInitialized = true;
		("IPC Manager initialized");
	}

	/**
	 * Register a window for IPC communication
	 */
	registerWindow(window: BrowserWindow): void {
		this.windows.add(window);
	}

	/**
	 * Unregister a window
	 */
	unregisterWindow(window: BrowserWindow): void {
		this.windows.delete(window);
	}

	/**
	 * Register a custom IPC handler
	 */
	registerHandler(handler: IPCHandler): void {
		if (this.handlers.has(handler.channel)) {
			console.warn(
				`IPC handler already exists for channel: ${handler.channel}`,
			);
			return;
		}

		// Check if handler already exists in Electron
		if (ipcMain.listenerCount(handler.channel) > 0) {
			console.warn(
				`IPC handler already registered in Electron for channel: ${handler.channel}`,
			);
			return;
		}

		this.handlers.set(handler.channel, handler);

		// List of channels that should return unwrapped data (not wrapped in {success, data})
		const unwrappedChannels = ["go-daemon-command"];

		ipcMain.handle(handler.channel, async (event, ...args) => {
			try {
				console.log(`IPC call: ${handler.channel}`, args);
				const result = await handler.handler(event, ...args);

				// For go-daemon-command, return unwrapped data
				if (unwrappedChannels.includes(handler.channel)) {
					return result;
				}

				// For other channels, wrap in success/data format
				return { success: true, data: result };
			} catch (error) {
				console.error(`IPC error: ${handler.channel}`, error);
				return {
					success: false,
					error: error instanceof Error ? error.message : "Unknown error",
				};
			}
		});

		`IPC handler registered: ${handler.channel}`;
	}

	/**
	 * Unregister an IPC handler
	 */
	unregisterHandler(channel: string): void {
		if (!this.handlers.has(channel)) return;

		ipcMain.removeHandler(channel);
		this.handlers.delete(channel);
		`IPC handler unregistered: ${channel}`;
	}

	/**
	 * Setup default IPC handlers
	 */
	private setupDefaultHandlers(): void {
		// Ping handler
		this.registerHandler({
			channel: "ping",
			handler: async () => {
				return { message: "pong", timestamp: Date.now() };
			},
			description: "Ping-pong handler for connection testing",
		});

		// App info handler
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

		// Window bounds handler
		this.registerHandler({
			channel: "get-window-bounds",
			handler: async (event) => {
				const window = BrowserWindow.fromWebContents(event.sender);
				if (!window) return null;
				return window.getBounds();
			},
			description: "Get current window bounds",
		});

		// Set window bounds handler
		this.registerHandler({
			channel: "set-window-bounds",
			handler: async (event, bounds) => {
				const window = BrowserWindow.fromWebContents(event.sender);
				if (!window) return false;
				window.setBounds(bounds);
				return true;
			},
			description: "Set window bounds",
		});

		// Exit app handler
		this.registerHandler({
			channel: "exit-app",
			handler: async () => {
				return await this.handleExitApp();
			},
			description: "Handle clean application exit",
		});

		// Daemon status handler
		this.registerHandler({
			channel: "get-daemon-status",
			handler: async () => {
				return daemonMonitor.getStatus();
			},
			description: "Get current daemon status",
		});

		// Daemon restart handler
		this.registerHandler({
			channel: "restart-daemon",
			handler: async () => {
				return await daemonMonitor.restartDaemon();
			},
			description: "Restart the daemon",
		});

		// Daemon start handler
		this.registerHandler({
			channel: "start-daemon",
			handler: async () => {
				return await daemonMonitor.startDaemon();
			},
			description: "Start the daemon",
		});

		// Daemon stop handler
		this.registerHandler({
			channel: "stop-daemon",
			handler: async () => {
				return await daemonMonitor.stopDaemon();
			},
			description: "Stop the daemon",
		});
	}

	/**
	 * Setup Go daemon IPC handlers
	 */
	private setupGoDaemonHandlers(): void {
		// Go daemon command handler - this is the main handler your renderer client uses
		this.registerHandler({
			channel: "go-daemon-command",
			handler: async (_event, action: string, payload?: unknown) => {
				return await this.handleGoDaemonCommand(action, payload);
			},
			description: "Handle Go daemon commands",
		});

		// Go daemon status handler
		this.registerHandler({
			channel: "get-daemon-status",
			handler: async () => {
				return await goDaemonClient.getDaemonStatus();
			},
			description: "Get Go daemon status",
		});

		// Go daemon ping handler
		this.registerHandler({
			channel: "ping-daemon",
			handler: async () => {
				return await goDaemonClient.ping();
			},
			description: "Ping Go daemon",
		});

		// File operations
		this.registerHandler({
			channel: "openFiles",
			handler: async (_event, action) => {
				try {
					const mainWindow = BrowserWindow.getFocusedWindow();
					if (!mainWindow) {
						console.warn("🟡 openFiles: No focused window");
						return { success: false, error: "No focused window" };
					}

					console.log("🟢 openFiles: Opening dialog with action:", action);
					let result;
					if (action === "file") {
						result = await dialog.showOpenDialog(mainWindow, {
							title: "Select Images",
							filters: [
								{
									name: "Images",
									extensions: [
										"jpg",
										"jpeg",
										"png",
										"gif",
										"bmp",
										"webp",
										"svg",
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

					console.log("🟢 openFiles: Dialog result:", { canceled: result.canceled, filePaths: result.filePaths });

					if (result.canceled) {
						console.log("🟡 openFiles: Dialog was canceled");
						return { success: true, files: [] };
					}

					if (!result.filePaths || result.filePaths.length === 0) {
						console.warn("🟡 openFiles: No file paths returned");
						return { success: true, files: [] };
					}

					let files: string[] = [];

					if (action === "folder") {
						// For folders, recursively scan for image files
						console.log("🟢 openFiles: Scanning folder(s) for images:", result.filePaths);
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
											// Recursively scan subdirectories
											const subImages = await scanDirectory(fullPath);
											imageFiles.push(...subImages);
										} else if (stats.isFile()) {
											// Check if it's an image file
											const ext = entry.toLowerCase().substring(entry.lastIndexOf("."));
											if (imageExtensions.has(ext)) {
												imageFiles.push(fullPath);
											}
										}
									} catch (err) {
										// Skip files/directories we can't access
										console.warn(`Could not access ${fullPath}:`, err);
									}
								}
							} catch (err) {
								console.error(`Error scanning directory ${dirPath}:`, err);
							}
							return imageFiles;
						};

						// Scan all selected folders
						for (const folderPath of result.filePaths) {
							const folderImages = await scanDirectory(folderPath);
							files.push(...folderImages);
						}

						console.log(`🟢 openFiles: Found ${files.length} image files in folder(s)`);
					} else {
						// For file selection, use the selected files directly
						files = result.filePaths;
					}

					if (files.length === 0) {
						console.warn("🟡 openFiles: No image files found");
						return { success: true, files: [] };
					}

					console.log("🟢 openFiles: Returning", files.length, "file paths");
					return { success: true, files };
				} catch (error) {
					console.error("Error opening files:", error);
					return {
						success: false,
						error: error instanceof Error ? error.message : "Unknown error",
					};
				}
			},
			description: "Open files dialog",
		});

		this.registerHandler({
			channel: "handleOpenImages",
			handler: async (_event, imagesObject) => {
				try {
					console.log("handleOpenImages called with:", imagesObject);

					if (
						!imagesObject.success ||
						!imagesObject.data.files ||
						imagesObject.data.files.length === 0
					) {
						return { success: true, message: "No files to process" };
					}

					// Send files to Go daemon for processing
					const files = imagesObject.data.files;
					console.log("Sending files to Go daemon:", files);

					// Extract file paths and names
					const imagePaths = files;
					const fileNames = files.map((filePath: string) => {
						const pathParts = filePath.split("/");
						return pathParts[pathParts.length - 1]; // Get filename from path
					});

					console.log("Processing images with paths:", imagePaths, "names:", fileNames);

					// Call Go daemon to process images
					// processImages returns Promise<void>, so we just await it
					// Events will be emitted by the daemon as images are processed
					await goDaemonClient.processImages(
						imagePaths,
						fileNames,
					);

					console.log("Successfully initiated image processing");
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
			description: "Handle opened images",
		});

		// Setup event forwarding from Go daemon to renderer
		this.setupGoDaemonEventForwarding();

		// Setup context menu handler
		this.setupContextMenuHandler();
	}

	/**
	 * Setup context menu handler
	 */
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
						image: options.Image as JsonStoreImage | undefined,
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
			description: "Show context menu for images/gallery",
		});
	}

	/**
	 * Setup theme IPC handlers
	 */
	private setupThemeHandlers(): void {
		// Get native theme handler
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
			description: "Get native theme information",
		});

		// Set theme source handler
		this.registerHandler({
			channel: "set-theme-source",
			handler: async (_event, source: "system" | "light" | "dark") => {
				const { nativeTheme } = require("electron");
				nativeTheme.themeSource = source;
				return true;
			},
			description: "Set native theme source",
		});

		// Theme changed handler
		this.registerHandler({
			channel: "theme-changed",
			handler: async (_event, themeName: string) => {
				`Theme changed to: ${themeName}`;
				// Broadcast to all windows
				this.broadcastToAllWindows("theme-changed", { themeName });
				return true;
			},
			description: "Handle theme change notifications",
		});
	}

	/**
	 * Setup window IPC handlers
	 */
	private setupWindowHandlers(): void {
		// Minimize window handler
		this.registerHandler({
			channel: "minimize-window",
			handler: async (event) => {
				const window = BrowserWindow.fromWebContents(event.sender);
				if (!window) return false;
				window.minimize();
				return true;
			},
			description: "Minimize current window",
		});

		// Maximize window handler
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
			description: "Maximize/unmaximize current window",
		});

		// Close window handler
		this.registerHandler({
			channel: "close-window",
			handler: async (event) => {
				const window = BrowserWindow.fromWebContents(event.sender);
				if (!window) return false;
				window.close();
				return true;
			},
			description: "Close current window",
		});

		// Hide window handler
		this.registerHandler({
			channel: "hide-window",
			handler: async (event) => {
				const window = BrowserWindow.fromWebContents(event.sender);
				if (!window) return false;
				window.hide();
				return true;
			},
			description: "Hide current window",
		});

		// Show window handler
		this.registerHandler({
			channel: "show-window",
			handler: async (event) => {
				const window = BrowserWindow.fromWebContents(event.sender);
				if (!window) return false;
				window.show();
				return true;
			},
			description: "Show current window",
		});
	}

	/**
	 * Setup error handling
	 */
	private setupErrorHandling(): void {
		// Global error handler
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

	/**
	 * Convert file paths to atom:// protocol for frontend consumption
	 */
	private convertPathsToAtomProtocol(
		images: JsonStoreImage[],
	): JsonStoreImage[] {
		if (!Array.isArray(images)) {
			return images;
		}

		// Create new objects to avoid mutating the originals
		return images.map((image) => {
			if (!image || typeof image !== "object") {
				return image;
			}

			// Create a shallow copy of the image
			const convertedImage = { ...image };
			console.log("convertedImage", convertedImage);

			// Convert main image path (only if not already atom:)
			if (
				convertedImage.path &&
				typeof convertedImage.path === "string" &&
				!convertedImage.path.startsWith("atom:")
			) {
				// Handle absolute paths properly - use atom:// for absolute paths
				if (convertedImage.path.startsWith("/")) {
					convertedImage.path = `atom://${convertedImage.path.substring(1)}`;
				} else {
					// For relative paths, expand to absolute first
					const absolutePath = resolve(convertedImage.path);
					convertedImage.path = `atom://${absolutePath.substring(1)}`;
				}
			}

			// Convert thumbnail paths (only if not already atom:)
			if (
				convertedImage.thumbnails &&
				typeof convertedImage.thumbnails === "object"
			) {
				// Create a copy of thumbnails to avoid mutating the original
				convertedImage.thumbnails = { ...convertedImage.thumbnails };
				Object.keys(convertedImage.thumbnails).forEach((key) => {
					const thumbnailPath =
						convertedImage.thumbnails[
							key as keyof typeof convertedImage.thumbnails
						];
					if (
						thumbnailPath &&
						typeof thumbnailPath === "string" &&
						!thumbnailPath.startsWith("atom:")
					) {
						// Handle absolute paths properly - use atom:// for absolute paths
						if (thumbnailPath.startsWith("/")) {
							convertedImage.thumbnails[
								key as keyof typeof convertedImage.thumbnails
							] = `atom://${thumbnailPath.substring(1)}`;
						} else {
							// For relative paths, expand to absolute first
							const absolutePath = resolve(thumbnailPath);
							convertedImage.thumbnails[
								key as keyof typeof convertedImage.thumbnails
							] = `atom://${absolutePath.substring(1)}`;
						}
					}
				});
			}

			return convertedImage;
		});
	}

	/**
	 * Handle Go daemon commands
	 */
	private async handleGoDaemonCommand(
		action: string,
		payload?: unknown,
	): Promise<unknown> {
		try {
			const typedPayload = payload as Record<string, unknown>;

			switch (action) {
				// ============================================================================
				// SYSTEM OPERATIONS
				// ============================================================================
				case "ping":
					return await goDaemonClient.ping();
				case "get_info":
					return await goDaemonClient.getInfo();
				case "get_monitors":
					return await goDaemonClient.getMonitors();
				case "get_daemon_status":
					return await goDaemonClient.getDaemonStatus();
				case "get_diagnostics":
					return await goDaemonClient.getDiagnostics(
						typedPayload?.monitorName as string | undefined,
					);
				case "kill_daemon":
					await goDaemonClient.killDaemon();
					return "daemon_kill_requested";
				case "stop_daemon":
					await goDaemonClient.stopDaemon();
					return "daemon_stop_requested";

				// ============================================================================
				// PLAYLIST OPERATIONS
				// ============================================================================
				case "get_playlists":
					return await goDaemonClient.getPlaylists();
				case "get_playlist":
					return await goDaemonClient.getPlaylist(
						typedPayload?.playlistId as number,
					);
				case "upsert_playlist":
				case "save_playlist": // Legacy support
					return await goDaemonClient.savePlaylist(
						typedPayload?.playlist as Parameters<typeof goDaemonClient.savePlaylist>[0],
					);
				case "delete_playlist":
					await goDaemonClient.deletePlaylist(
						typedPayload?.playlistName as string,
					);
					return "playlist deleted";
				case "start_playlist":
					await goDaemonClient.startPlaylist(
						typedPayload?.playlistId as number,
						typedPayload?.activeMonitor as Parameters<typeof goDaemonClient.startPlaylist>[1],
					);
					return "playlist started";
				case "stop_playlist":
					await goDaemonClient.stopPlaylist(
						typedPayload?.activeMonitor as Parameters<typeof goDaemonClient.stopPlaylist>[0],
					);
					return "playlist stopped";
				case "pause_playlist":
					await goDaemonClient.pausePlaylist(
						typedPayload?.activeMonitor as Parameters<typeof goDaemonClient.pausePlaylist>[0],
					);
					return "playlist paused";
				case "resume_playlist":
					await goDaemonClient.resumePlaylist(
						typedPayload?.activeMonitor as Parameters<typeof goDaemonClient.resumePlaylist>[0],
					);
					return "playlist resumed";
				case "next_playlist_image":
				case "next_image": // Legacy support
					await goDaemonClient.nextPlaylistImage(
						typedPayload?.activeMonitor as Parameters<typeof goDaemonClient.nextPlaylistImage>[0],
					);
					return "image changed";
				case "previous_playlist_image":
				case "previous_image": // Legacy support
					await goDaemonClient.previousPlaylistImage(
						typedPayload?.activeMonitor as Parameters<typeof goDaemonClient.previousPlaylistImage>[0],
					);
					return "image changed";
				case "get_running_playlists":
				case "get_active_playlists": // Legacy support
				case "get_active_playlist": // Legacy support
					return await goDaemonClient.getRunningPlaylists();
				case "get_playlist_images": // Legacy support
					return await goDaemonClient.getPlaylist(
						typedPayload?.playlistId as number,
					);

				// ============================================================================
				// IMAGE OPERATIONS
				// ============================================================================
				case "get_images": {
					const images = await goDaemonClient.getImages(typedPayload?.filters);
					console.log("🔍 IPC Manager: Raw images from daemon:", images);
					return this.convertPathsToAtomProtocol(images);
				}
				case "process_images":
					await goDaemonClient.processImages(
						typedPayload?.imagePaths as string[] || [],
						typedPayload?.fileNames as string[] || [],
					);
					return true;
				case "delete_images":
				case "delete_image_from_gallery": // Legacy support
					await goDaemonClient.deleteImages(
						typedPayload?.imageIds as number[],
					);
					return "images deleted";
				case "upsert_image":
					await goDaemonClient.upsertImage(
						typedPayload?.image as Parameters<typeof goDaemonClient.upsertImage>[0],
					);
					return "image updated";
				case "get_image_history":
					return await goDaemonClient.getImageHistory();
				case "process_for_monitors":
					return await goDaemonClient.processForMonitors(
						(typedPayload?.image as { id: number })?.id,
						typedPayload?.activeMonitor as Parameters<typeof goDaemonClient.processForMonitors>[1],
					);

				// ============================================================================
				// CONFIGURATION OPERATIONS
				// ============================================================================
				case "get_config":
					return await goDaemonClient.getConfig();
				case "upsert_config":
				case "set_config": // Legacy support
					{
						const config = typedPayload?.config as {
							configSection?: string;
							configKey?: string;
							configValue?: unknown;
							frontendConfig?: Record<string, unknown>;
						};

						if (config?.frontendConfig) {
							// Bulk update
							await goDaemonClient.setBulkConfig(config.frontendConfig);
						} else if (config?.configSection && config?.configKey) {
							// Single key update
							await goDaemonClient.setConfig(
								config.configSection,
								config.configKey,
								config.configValue,
							);
						}

						return true;
					}
				case "set_selected_monitor":
					await goDaemonClient.setSelectedMonitor(
						typedPayload?.activeMonitor as Parameters<typeof goDaemonClient.setSelectedMonitor>[0],
					);
					return "monitor configuration updated";
				case "get_selected_monitor":
					return await goDaemonClient.getSelectedMonitor();

				// ============================================================================
				// MISCELLANEOUS OPERATIONS
				// ============================================================================
				case "set_image":
					await goDaemonClient.setImage(
						(typedPayload?.image as { id: number; name: string })?.id,
						(typedPayload?.image as { id: number; name: string })?.name || "",
						typedPayload?.activeMonitor as Parameters<typeof goDaemonClient.setImage>[2],
					);
					return "image changed";
				case "set_image_across_monitors":
					await goDaemonClient.setImageAcrossMonitors(
						(typedPayload?.image as { id: number; name: string })?.id,
						(typedPayload?.image as { id: number; name: string })?.name || "",
						typedPayload?.activeMonitor as Parameters<typeof goDaemonClient.setImageAcrossMonitors>[2],
					);
					return "image set across monitors";
				case "duplicate_image_across_monitors":
					await goDaemonClient.duplicateImageAcrossMonitors(
						(typedPayload?.image as { id: number })?.id,
						typedPayload?.activeMonitor as Parameters<typeof goDaemonClient.duplicateImageAcrossMonitors>[1],
					);
					return "image duplicated across monitors";
				case "next_image_history":
					await goDaemonClient.nextImageHistory(
						typedPayload?.activeMonitor as Parameters<typeof goDaemonClient.nextImageHistory>[0],
					);
					return "image changed from history";
				case "previous_image_history":
					await goDaemonClient.previousImageHistory(
						typedPayload?.activeMonitor as Parameters<typeof goDaemonClient.previousImageHistory>[0],
					);
					return "image changed from history";
				case "random_image":
					await goDaemonClient.randomImage(
						typedPayload?.activeMonitor as Parameters<typeof goDaemonClient.randomImage>[0],
					);
					return "image changed";

				// ============================================================================
				// EVENT SUBSCRIPTION
				// ============================================================================
				case "subscribe":
					await goDaemonClient.subscribeToEvents(
						typedPayload?.eventTypes as Parameters<typeof goDaemonClient.subscribeToEvents>[0],
					);
					return "subscribed to events";
				case "unsubscribe":
					await goDaemonClient.unsubscribeFromEvents(
						typedPayload?.eventTypes as Parameters<typeof goDaemonClient.unsubscribeFromEvents>[0],
					);
					return "unsubscribed from events";

				// ============================================================================
				// LEGACY COMPATIBILITY
				// ============================================================================
				case "get_app_config":
				case "get_frontend_config":
					return await goDaemonClient.getConfig();
				case "set_app_config":
				case "set_frontend_config":
					await goDaemonClient.setBulkConfig(payload as Parameters<typeof goDaemonClient.setBulkConfig>[0]);
					return true;
				case "get_swww_config": {
					const config = await goDaemonClient.getConfig();
					return config.backend.swww;
				}
				case "set_swww_config":
					await goDaemonClient.setSwwwConfig(payload as Parameters<typeof goDaemonClient.setSwwwConfig>[0]);
					return true;

				default:
					throw new Error(`Unknown Go daemon action: ${action}`);
			}
		} catch (error) {
			console.error(`Go daemon command failed: ${action}`, error);
			throw error;
		}
	}

	/**
	 * Setup Go daemon event forwarding to renderer processes
	 */
	private setupGoDaemonEventForwarding(): void {
		// Subscribe to all events from the Go daemon
		// Note: The subscribe action may not be validated, but we try anyway
		// Events will still be received if the daemon broadcasts them
		goDaemonClient.subscribeToEvents(["*"]).catch((error) => {
			console.warn("Failed to subscribe to events (may not be supported):", error);
		});

		// Listen for all events from the Go daemon client
		goDaemonClient.on("playlist_updated", (data) => {
			this.broadcastToAllWindows("go-daemon-event-playlist_updated", data);
		});

		goDaemonClient.on("config_changed", (data) => {
			this.broadcastToAllWindows("go-daemon-event-config_changed", data);
		});

		goDaemonClient.on("images_updated", (data) => {
			this.broadcastToAllWindows("go-daemon-event-images_updated", data);
		});

		goDaemonClient.on("image_processed", (data) => {
			console.log("🟢 IPCManager: Received image_processed event, forwarding to renderer", data);
			this.broadcastToAllWindows("go-daemon-event-image_processed", data);
		});

		goDaemonClient.on("image_error", (data) => {
			console.log("🔴 IPCManager: Received image_error event, forwarding to renderer", data);
			this.broadcastToAllWindows("go-daemon-event-image_error", data);
		});

		goDaemonClient.on("processing_complete", (data) => {
			console.log("✅ IPCManager: Received processing_complete event, forwarding to renderer", data);
			this.broadcastToAllWindows("go-daemon-event-processing_complete", data);
		});

		goDaemonClient.on("processing_started", (data) => {
			console.log("🚀 IPCManager: Received processing_started event, forwarding to renderer", data);
			this.broadcastToAllWindows("go-daemon-event-processing_started", data);
		});

		goDaemonClient.on("image_progress", (data) => {
			console.log("📊 IPCManager: Received image_progress event, forwarding to renderer", data);
			this.broadcastToAllWindows("go-daemon-event-image_progress", data);
		});

		goDaemonClient.on("thumbnail_created", (data) => {
			this.broadcastToAllWindows("go-daemon-event-thumbnail_created", data);
		});

		goDaemonClient.on("displays_changed", (data) => {
			this.broadcastToAllWindows("go-daemon-event-displays_changed", data);
		});

		// Context menu events
		goDaemonClient.on("clear_selection", (data) => {
			this.broadcastToAllWindows("go-daemon-event-clear_selection", data);
		});

		goDaemonClient.on("set_images_per_page", (data) => {
			this.broadcastToAllWindows("go-daemon-event-set_images_per_page", data);
		});

		goDaemonClient.on("select_all_images_in_gallery", (data) => {
			this.broadcastToAllWindows(
				"go-daemon-event-select_all_images_in_gallery",
				data,
			);
		});

		goDaemonClient.on("select_all_images_in_current_page", (data) => {
			this.broadcastToAllWindows(
				"go-daemon-event-select_all_images_in_current_page",
				data,
			);
		});

		goDaemonClient.on("clear_selection_on_current_page", (data) => {
			this.broadcastToAllWindows(
				"go-daemon-event-clear_selection_on_current_page",
				data,
			);
		});

		goDaemonClient.on("remove_selected_images_from_playlist", (data) => {
			this.broadcastToAllWindows(
				"go-daemon-event-remove_selected_images_from_playlist",
				data,
			);
		});

		goDaemonClient.on("delete_all_selected_images", (data) => {
			this.broadcastToAllWindows(
				"go-daemon-event-delete_all_selected_images",
				data,
			);
		});

		goDaemonClient.on("add_selected_images_to_playlist", (data) => {
			this.broadcastToAllWindows(
				"go-daemon-event-add_selected_images_to_playlist",
				data,
			);
		});

		goDaemonClient.on("delete_image_from_gallery", (data) => {
			this.broadcastToAllWindows(
				"go-daemon-event-delete_image_from_gallery",
				data,
			);
		});

		goDaemonClient.on("clear_playlist", (data) => {
			this.broadcastToAllWindows("go-daemon-event-clear_playlist", data);
		});

		("Go daemon event forwarding setup complete");
	}

	/**
	 * Broadcast message to all windows
	 */
	private broadcastToAllWindows(channel: string, data: any): void {
		this.windows.forEach((window) => {
			if (!window.isDestroyed()) {
				window.webContents.send(channel, data);
			}
		});
	}

	/**
	 * Get all registered handlers
	 */
	getAllHandlers(): IPCHandler[] {
		return Array.from(this.handlers.values());
	}

	/**
	 * Get handler count
	 */
	getHandlerCount(): number {
		return this.handlers.size;
	}

	/**
	 * Handle clean application exit
	 */
	private async handleExitApp(): Promise<boolean> {
		try {
			console.log("🔄 IPCManager: Handling clean application exit...");

			// Get the current configuration to check if we should stop the daemon
			const config = await goDaemonClient.getConfig() as any;
			const shouldStopDaemon = config?.app?.kill_daemon_on_exit ?? false;

			if (shouldStopDaemon) {
				console.log("🔄 IPCManager: Stopping daemon on exit...");
				await goDaemonClient.stopDaemon();
				console.log("✅ IPCManager: Daemon stopped successfully");
			} else {
				console.log("ℹ️ IPCManager: Keeping daemon running on exit");
			}

			// Close all windows gracefully
			("🔄 IPCManager: Closing all windows...");
			this.windows.forEach((window) => {
				if (!window.isDestroyed()) {
					window.close();
				}
			});

			// Quit the application
			("🔄 IPCManager: Quitting application...");
			app.quit();

			return true;
		} catch (error) {
			console.error("❌ IPCManager: Error during application exit:", error);

			// Force quit even if there's an error
			("🔄 IPCManager: Force quitting application...");
			app.quit();

			return false;
		}
	}

	/**
	 * Cleanup
	 */
	cleanup(): void {
		this.handlers.forEach((_handler, channel) => {
			ipcMain.removeHandler(channel);
		});
		this.handlers.clear();
		this.windows.clear();
		this.isInitialized = false;
		("IPC Manager cleaned up");
	}
}

export default IPCManager;
