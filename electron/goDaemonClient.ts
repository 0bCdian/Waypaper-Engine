import { createConnection, Socket } from "node:net";
import { EventEmitter } from "node:events";
import { logger } from "../globals/setup";
import { configReader } from "../globals/configReader";
import type {
	JsonStoreImage,
	DaemonActivePlaylist,
	DaemonImageHistory,
	DaemonPlaylist,
	DaemonMonitor,
	DaemonSwwwConfig,
} from "../shared/types/daemon";
import type { ActiveMonitor } from "../shared/types/monitor";
import type { rendererPlaylist } from "../src/types/rendererTypes";

export interface GoDaemonMessage {
	action: string;
	data?: unknown;
	error?: string;
	messageId?: number;
}

export interface GoDaemonResponse {
	action?: string;
	data?: unknown;
	error?: string;
	messageId?: number;
	type?: string;
	payload?: unknown;
}

export class GoDaemonClient extends EventEmitter {
	private socket: Socket | null = null;
	private socketPath: string;
	private isConnected: boolean = false;
	private reconnectAttempts: number = 0;
	private maxReconnectAttempts: number = 10;
	private reconnectInterval: number = 1000;
	private messageId: number = 0;
	private pendingMessages: Map<
		number,
		{ resolve: (value: unknown) => void; reject: (error: unknown) => void }
	> = new Map();
	private messageBuffer: string = "";

	constructor(socketPath?: string) {
		super();
		// Use provided socket path or get from config
		this.socketPath = socketPath || configReader.getSocketPath();
	}

	async connect(): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				this.socket = createConnection(this.socketPath, () => {
					this.isConnected = true;
					this.reconnectAttempts = 0;
					logger.info("Connected to Go daemon");
					this.emit("connected");
					resolve();
				});

				this.socket.on("data", (data) => {
					this.handleMessage(data);
				});

				this.socket.on("error", (error) => {
					logger.error("Socket error:", error);
					this.isConnected = false;
					this.emit("error", error);
					this.handleReconnect();
				});

				this.socket.on("close", () => {
					logger.warn("Connection to Go daemon closed");
					this.isConnected = false;
					this.emit("disconnected");
					this.handleReconnect();
				});

				this.socket.on("end", () => {
					logger.warn("Go daemon ended connection");
					this.isConnected = false;
					this.emit("disconnected");
					this.handleReconnect();
				});
			} catch (error) {
				logger.error("Failed to connect to Go daemon:", error);
				reject(error);
			}
		});
	}

	private handleMessage(data: Buffer): void {
		// Add the new data to our buffer
		this.messageBuffer += data.toString();

		// Try to parse complete JSON messages
		let startIndex = 0;
		while (startIndex < this.messageBuffer.length) {
			// Find the end of a complete JSON object
			let braceCount = 0;
			let endIndex = startIndex;
			let inString = false;
			let escaped = false;

			for (let i = startIndex; i < this.messageBuffer.length; i++) {
				const char = this.messageBuffer[i];

				if (escaped) {
					escaped = false;
					continue;
				}

				if (char === "\\") {
					escaped = true;
					continue;
				}

				if (char === '"') {
					inString = !inString;
					continue;
				}

				if (!inString) {
					if (char === "{") {
						braceCount++;
					} else if (char === "}") {
						braceCount--;
						if (braceCount === 0) {
							endIndex = i + 1;
							break;
						}
					}
				}
			}

			// If we found a complete JSON object, parse it
			if (braceCount === 0 && endIndex > startIndex) {
				const message = this.messageBuffer.substring(startIndex, endIndex);
				try {
					const parsed: GoDaemonResponse = JSON.parse(message);

					// Handle ping/pong
					if (parsed.action === "pong") {
						this.emit("pong");

						// Resolve any pending ping command
						const messageId = this.extractMessageId(parsed);
						if (messageId && this.pendingMessages.has(messageId)) {
							const { resolve } = this.pendingMessages.get(messageId)!;
							this.pendingMessages.delete(messageId);
							resolve(true); // Ping successful
						}

						startIndex = endIndex;
						continue;
					}

					// Handle events (including real-time image processing events)
					// Check for both action-based and type-based events
					const eventType = parsed.action || parsed.type;
					const eventData = parsed.data || parsed.payload;

					if (
						eventType &&
						(eventType.startsWith("playlist_") ||
							eventType.startsWith("wallpaper_") ||
							eventType.startsWith("images_") ||
							eventType.startsWith("config_") ||
							eventType === "image_processed" ||
							eventType === "image_error" ||
							eventType === "processing_complete" ||
							eventType === "thumbnail_created")
					) {
						this.emit(eventType, eventData);
						startIndex = endIndex;
						continue;
					}

					// Handle responses to pending messages
					const messageId = this.extractMessageId(parsed);
					if (messageId && this.pendingMessages.has(messageId)) {
						const { resolve, reject } = this.pendingMessages.get(messageId)!;
						this.pendingMessages.delete(messageId);

						if (parsed.error) {
							reject(new Error(parsed.error));
						} else {
							resolve(parsed.data);
						}
					}
				} catch (error) {
					logger.error("Failed to parse message from Go daemon:", error);
				}
				startIndex = endIndex;
			} else {
				// Incomplete message, wait for more data
				break;
			}
		}

		// Remove processed messages from buffer
		this.messageBuffer = this.messageBuffer.substring(startIndex);
	}

	private extractMessageId(response: GoDaemonResponse): number | null {
		// Extract messageId from the response
		if (response && typeof response === "object" && "messageId" in response) {
			return response.messageId as number;
		}
		return null;
	}

	private async handleReconnect(): Promise<void> {
		if (this.reconnectAttempts >= this.maxReconnectAttempts) {
			logger.error("Max reconnection attempts reached");
			this.emit("maxReconnectAttemptsReached");
			return;
		}

		this.reconnectAttempts++;
		logger.info(
			`Attempting to reconnect to Go daemon (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
		);

		setTimeout(async () => {
			try {
				await this.connect();
			} catch (error) {
				logger.error("Reconnection failed:", error);
			}
		}, this.reconnectInterval * this.reconnectAttempts);
	}

	async sendCommand(action: string, payload?: unknown): Promise<unknown> {
		if (!this.isConnected || !this.socket) {
			throw new Error("Not connected to Go daemon");
		}

		return new Promise((resolve, reject) => {
			const messageId = ++this.messageId;
			const message: GoDaemonMessage = {
				action,
				messageId,
				...(payload && typeof payload === "object" ? payload : {}),
			};

			this.pendingMessages.set(messageId, {
				resolve: (value) => {
					resolve(value);
				},
				reject: (error) => {
					reject(error);
				},
			});

			try {
				const messageStr = JSON.stringify(message) + "\n";
				this.socket!.write(messageStr);
			} catch (error) {
				this.pendingMessages.delete(messageId);
				reject(error);
			}
		});
	}

	// Image navigation commands

	async setImage(imageId: number, monitorName: string): Promise<boolean> {
		const payload = {
			image: { id: imageId },
			activeMonitor: { name: monitorName },
		};
		return this.sendCommand("set_image", payload) as Promise<boolean>;
	}

	// Multi-monitor operations
	async setImageAcrossMonitors(
		imageId: number,
		activeMonitor: ActiveMonitor,
	): Promise<boolean> {
		const payload = {
			image: { id: imageId },
			activeMonitor,
		};
		return this.sendCommand(
			"set_image_across_monitors",
			payload,
		) as Promise<boolean>;
	}

	async duplicateImageAcrossMonitors(
		imageId: number,
		activeMonitor: ActiveMonitor,
	): Promise<boolean> {
		const payload = {
			image: { id: imageId },
			activeMonitor,
		};
		return this.sendCommand(
			"duplicate_image_across_monitors",
			payload,
		) as Promise<boolean>;
	}

	async processForMonitors(
		imageId: number,
		activeMonitor: ActiveMonitor,
	): Promise<boolean> {
		const payload = {
			image: { id: imageId },
			activeMonitor,
		};
		return this.sendCommand(
			"process_for_monitors",
			payload,
		) as Promise<boolean>;
	}

	// Data queries
	async getImages(filters?: unknown): Promise<JsonStoreImage[]> {
		const response = await this.sendCommand("get_images", { filters });
		return response as JsonStoreImage[];
	}

	async getPlaylists(): Promise<DaemonPlaylist[]> {
		return this.sendCommand("get_playlists") as Promise<DaemonPlaylist[]>;
	}

	async getActivePlaylist(
		activeMonitor: ActiveMonitor,
	): Promise<DaemonActivePlaylist | null> {
		return (await this.sendCommand("get_active_playlist", {
			activeMonitor,
		})) as Promise<DaemonActivePlaylist | null>;
	}

	async getImageHistory(): Promise<DaemonImageHistory[]> {
		return (await this.sendCommand("get_image_history")) as Promise<
			DaemonImageHistory[]
		>;
	}

	async getMonitors(): Promise<DaemonMonitor[]> {
		return (await this.sendCommand("get_monitors")) as Promise<DaemonMonitor[]>;
	}

	async savePlaylist(playlist: rendererPlaylist): Promise<boolean> {
		return (await this.sendCommand("save_playlist", {
			playlist,
		})) as Promise<boolean>;
	}

	async getRunningPlaylists(): Promise<unknown> {
		return (await this.sendCommand(
			"get_running_playlists",
		)) as Promise<unknown>;
	}

	async deletePlaylist(playlistName: string): Promise<boolean> {
		return (await this.sendCommand("delete_playlist", {
			playlistName,
		})) as Promise<boolean>;
	}

	async getPlaylistImages(playlistId: number): Promise<unknown> {
		return (await this.sendCommand("get_playlist_images", {
			playlistId,
		})) as Promise<unknown>;
	}

	async deleteImagesFromGallery(imageIds: number[]): Promise<boolean> {
		return (await this.sendCommand("delete_image_from_gallery", {
			imageIds,
		})) as Promise<boolean>;
	}

	async getDiagnostics(monitorName?: string): Promise<unknown> {
		return (await this.sendCommand("get_diagnostics", {
			monitorName,
		})) as Promise<unknown>;
	}

	// Playlist control methods
	async startPlaylist(
		playlistName: string,
		activeMonitor: ActiveMonitor,
	): Promise<boolean> {
		return (await this.sendCommand("start_playlist", {
			playlistName,
			activeMonitor,
		})) as Promise<boolean>;
	}

	async pausePlaylist(activeMonitor: ActiveMonitor): Promise<boolean> {
		return (await this.sendCommand("pause_playlist", {
			activeMonitor,
		})) as Promise<boolean>;
	}

	async resumePlaylist(activeMonitor: ActiveMonitor): Promise<boolean> {
		return (await this.sendCommand("resume_playlist", {
			activeMonitor,
		})) as Promise<boolean>;
	}

	async stopPlaylist(activeMonitor: ActiveMonitor): Promise<boolean> {
		return (await this.sendCommand("stop_playlist", {
			activeMonitor,
		})) as Promise<boolean>;
	}

	async nextImage(activeMonitor: ActiveMonitor): Promise<boolean> {
		return (await this.sendCommand("next_image", {
			activeMonitor,
		})) as Promise<boolean>;
	}

	async previousImage(activeMonitor: ActiveMonitor): Promise<boolean> {
		return (await this.sendCommand("previous_image", {
			activeMonitor,
		})) as Promise<boolean>;
	}

	async randomImage(activeMonitor: ActiveMonitor): Promise<boolean> {
		return (await this.sendCommand("random_image", {
			activeMonitor,
		})) as Promise<boolean>;
	}

	async getInfo(): Promise<unknown> {
		return this.sendCommand("get_info") as Promise<unknown>;
	}

	async killDaemon(): Promise<boolean> {
		return this.sendCommand("kill_daemon") as Promise<boolean>;
	}

	// Configuration commands
	async getConfig(): Promise<unknown> {
		return this.sendCommand("get_config") as Promise<unknown>;
	}

	async setConfig(
		section: string,
		key: string,
		value: unknown,
	): Promise<boolean> {
		return this.sendCommand("set_config", {
			config: {
				configSection: section,
				configKey: key,
				configValue: value,
			},
		}) as Promise<boolean>;
	}

	async getSwwwConfig(): Promise<DaemonSwwwConfig> {
		return this.sendCommand("get_swww_config") as Promise<DaemonSwwwConfig>;
	}

	// Image processing
	async processImages(
		imagePaths: string[],
		fileNames: string[],
	): Promise<boolean> {
		const payload = {
			imagePaths,
			fileNames,
		};
		return this.sendCommand("process_images", payload) as Promise<boolean>;
	}

	// System commands
	async ping(): Promise<boolean> {
		return this.sendCommand("ping") as Promise<boolean>;
	}

	async getDaemonStatus(): Promise<unknown> {
		return this.sendCommand("get_daemon_status") as Promise<unknown>;
	}

	async stopDaemon(): Promise<boolean> {
		return this.sendCommand("stop_daemon") as Promise<boolean>;
	}

	// Monitor operations

	async setSelectedMonitor(activeMonitor: ActiveMonitor): Promise<boolean> {
		return (await this.sendCommand("set_selected_monitor", {
			activeMonitor,
		})) as Promise<boolean>;
	}

	async getSelectedMonitor(): Promise<unknown> {
		return (await this.sendCommand("get_selected_monitor")) as Promise<unknown>;
	}

	// Missing methods that are being called
	async getActivePlaylists(): Promise<unknown> {
		return this.sendCommand("get_active_playlists") as Promise<unknown>;
	}

	async getAppConfig(): Promise<unknown> {
		return this.sendCommand("get_app_config") as Promise<unknown>;
	}

	async setAppConfig(config: unknown): Promise<boolean> {
		return this.sendCommand("set_app_config", { config }) as Promise<boolean>;
	}

	async setSwwwConfig(config: unknown): Promise<boolean> {
		return this.sendCommand("set_swww_config", { config }) as Promise<boolean>;
	}

	async getImageSrc(imageId: number): Promise<string> {
		return this.sendCommand("get_image_src", { imageId }) as Promise<string>;
	}

	async getThumbnailSrc(imageId: number): Promise<string> {
		return this.sendCommand("get_thumbnail_src", { imageId }) as Promise<string>;
	}

	async getMonitorImage(monitorName: string): Promise<string> {
		return this.sendCommand("get_monitor_image", { monitorName }) as Promise<string>;
	}

	async openContextMenu(x: number, y: number, imageId?: number): Promise<void> {
		return this.sendCommand("open_context_menu", { x, y, imageId }) as Promise<void>;
	}

	async updateTray(): Promise<void> {
		return this.sendCommand("update_tray") as Promise<void>;
	}

	async setPartialConfig(section: string, key: string, value: unknown): Promise<boolean> {
		return this.sendCommand("set_partial_config", { section, key, value }) as Promise<boolean>;
	}

	async setFrontendConfig(config: unknown): Promise<boolean> {
		return this.sendCommand("set_config", {
			frontendConfig: config,
		}) as Promise<boolean>;
	}

	async getFrontendConfig(): Promise<unknown> {
		return this.sendCommand("get_frontend_config") as Promise<unknown>;
	}

	async testConnection(): Promise<boolean> {
		return this.sendCommand("test_connection") as Promise<boolean>;
	}

	async startDaemon(): Promise<boolean> {
		return this.sendCommand("start_daemon") as Promise<boolean>;
	}

	async stopPlaylistByName(playlistName: string): Promise<boolean> {
		return this.sendCommand("stop_playlist_by_name", { playlistName }) as Promise<boolean>;
	}

	async stopPlaylistByMonitorName(monitorName: string): Promise<boolean> {
		return this.sendCommand("stop_playlist_by_monitor_name", { monitorName }) as Promise<boolean>;
	}

	async stopPlaylistOnRemovedMonitors(): Promise<boolean> {
		return this.sendCommand("stop_playlist_on_removed_monitors") as Promise<boolean>;
	}

	async updateConfig(config?: unknown): Promise<boolean> {
		return this.sendCommand("update_config", config ? { config } : {}) as Promise<boolean>;
	}

	disconnect(): void {
		if (this.socket) {
			this.socket.end();
			this.socket = null;
		}
		this.isConnected = false;
		this.emit("disconnected");
	}

	isConnectedToDaemon(): boolean {
		return this.isConnected;
	}
}

// Singleton instance
export const goDaemonClient = new GoDaemonClient();
