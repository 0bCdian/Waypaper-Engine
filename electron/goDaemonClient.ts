import { createConnection, Socket } from "node:net";
import { EventEmitter } from "node:events";
import { logger } from "../globals/setup";
import { configReader } from "../globals/configReader";
import type { JsonStoreImage } from "../shared/types/daemon";
import type {
	ActiveMonitor,
	MonitorSelection,
	Monitor,
} from "../shared/types/monitor";
import { convertToMonitorSelection } from "../shared/types/monitor";
import type {
	DaemonMessage,
	DaemonResponse,
	DaemonEvent,
	EventType,
	RendererPlaylist,
	StoredPlaylist,
	RunningPlaylistInfo,
	ImageHistory,
	ImageInfo,
	UnifiedConfig,
	DaemonInfo,
	DaemonStatus,
	PlaylistDiagnostics,
	ConfigData,
} from "./daemon-go-types";

export interface GoDaemonMessage extends DaemonMessage {}

export interface GoDaemonResponse extends DaemonResponse {}

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
	private subscribedEvents: Set<EventType | "*"> = new Set();

	constructor(socketPath?: string) {
		super();
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

					// Subscribe to all events by default
					this.subscribeToEvents(["*"]).catch((error) => {
						logger.error("Failed to subscribe to events:", error);
					});

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
		this.messageBuffer += data.toString();

		let startIndex = 0;
		while (startIndex < this.messageBuffer.length) {
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

			if (braceCount === 0 && endIndex > startIndex) {
				const message = this.messageBuffer.substring(startIndex, endIndex);
				try {
					const parsed = JSON.parse(message);

					// Handle pong
					if (parsed.action === "pong") {
						this.emit("pong");
						const messageId = this.extractMessageId(parsed);
						if (messageId && this.pendingMessages.has(messageId)) {
							const { resolve } = this.pendingMessages.get(messageId)!;
							this.pendingMessages.delete(messageId);
							resolve(true);
						}
						startIndex = endIndex;
						continue;
					}

					// Handle events (has 'type' field, no 'action' field)
					if (parsed.type && !parsed.action) {
						const event = parsed as DaemonEvent;
						this.emit(event.type, event.payload);
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
				break;
			}
		}

		this.messageBuffer = this.messageBuffer.substring(startIndex);
	}

	private extractMessageId(
		response: GoDaemonResponse | DaemonEvent,
	): number | null {
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

			// Add timeout to prevent hanging requests
			// Use longer timeout for operations that might take time (like get_images during processing)
			const timeoutDuration = action === "get_images" ? 60000 : 30000; // 60s for get_images, 30s for others
			setTimeout(() => {
				if (this.pendingMessages.has(messageId)) {
					this.pendingMessages.delete(messageId);
					reject(new Error(`Command timeout: ${action}`));
				}
			}, timeoutDuration);

			try {
				const messageStr = JSON.stringify(message) + "\n";
				this.socket!.write(messageStr);
			} catch (error) {
				this.pendingMessages.delete(messageId);
				reject(error);
			}
		});
	}

	// ============================================================================
	// EVENT SUBSCRIPTION
	// ============================================================================

	async subscribeToEvents(eventTypes: Array<EventType | "*">): Promise<void> {
		await this.sendCommand("subscribe", { eventTypes });
		eventTypes.forEach((type) => this.subscribedEvents.add(type));
	}

	async unsubscribeFromEvents(
		eventTypes: Array<EventType | "*">,
	): Promise<void> {
		await this.sendCommand("unsubscribe", { eventTypes });
		eventTypes.forEach((type) => this.subscribedEvents.delete(type));
	}

	// ============================================================================
	// SYSTEM OPERATIONS
	// ============================================================================

	async ping(): Promise<boolean> {
		try {
			await this.sendCommand("ping");
			return true;
		} catch {
			return false;
		}
	}

	async getInfo(): Promise<DaemonInfo> {
		return (await this.sendCommand("get_info")) as DaemonInfo;
	}

	async getMonitors(): Promise<Monitor[]> {
		const response = await this.sendCommand("get_monitors");
		// Handle case where Go daemon returns a map/object instead of array
		if (Array.isArray(response)) {
			return response as Monitor[];
		}
		if (typeof response === "object" && response !== null) {
			// Convert object/map to array
			return Object.values(response) as Monitor[];
		}
		return [];
	}

	async getDaemonStatus(): Promise<DaemonStatus> {
		return (await this.sendCommand("get_daemon_status")) as DaemonStatus;
	}

	async getDiagnostics(monitorName?: string): Promise<PlaylistDiagnostics> {
		return (await this.sendCommand("get_diagnostics", {
			monitorName,
		})) as PlaylistDiagnostics;
	}

	async killDaemon(): Promise<void> {
		await this.sendCommand("kill_daemon");
	}

	async stopDaemon(): Promise<void> {
		await this.sendCommand("stop_daemon");
	}

	// ============================================================================
	// PLAYLIST OPERATIONS
	// ============================================================================

	async getPlaylists(): Promise<StoredPlaylist[]> {
		return (await this.sendCommand("get_playlists")) as StoredPlaylist[];
	}

	async getPlaylist(playlistId: number): Promise<StoredPlaylist> {
		return (await this.sendCommand("get_playlist", {
			playlistId,
		})) as StoredPlaylist;
	}

	async savePlaylist(playlist: RendererPlaylist): Promise<StoredPlaylist> {
		// Convert ActiveMonitor to MonitorSelection if needed
		if (playlist.activeMonitor) {
			const activeMonitor = playlist.activeMonitor as ActiveMonitor;
			if (!("mode" in activeMonitor) || !activeMonitor.mode) {
				playlist.activeMonitor = convertToMonitorSelection(activeMonitor);
			}
		}

		const result = (await this.sendCommand("upsert_playlist", {
			playlist,
		})) as StoredPlaylist;
		return result;
	}

	async deletePlaylist(playlistName: string): Promise<void> {
		await this.sendCommand("delete_playlist", { playlistName });
	}

	async startPlaylist(
		playlistId: number,
		activeMonitor: ActiveMonitor | MonitorSelection,
	): Promise<void> {
		// Convert to MonitorSelection if needed
		const monitorSelection =
			"mode" in activeMonitor
				? activeMonitor
				: convertToMonitorSelection(activeMonitor);

		await this.sendCommand("start_playlist", {
			playlistId,
			activeMonitor: monitorSelection,
		});
	}

	async stopPlaylist(
		activeMonitor: ActiveMonitor | MonitorSelection,
	): Promise<void> {
		const monitorSelection =
			"mode" in activeMonitor
				? activeMonitor
				: convertToMonitorSelection(activeMonitor);

		await this.sendCommand("stop_playlist", {
			activeMonitor: monitorSelection,
		});
	}

	async pausePlaylist(
		activeMonitor: ActiveMonitor | MonitorSelection,
	): Promise<void> {
		const monitorSelection =
			"mode" in activeMonitor
				? activeMonitor
				: convertToMonitorSelection(activeMonitor);

		await this.sendCommand("pause_playlist", {
			activeMonitor: monitorSelection,
		});
	}

	async resumePlaylist(
		activeMonitor: ActiveMonitor | MonitorSelection,
	): Promise<void> {
		const monitorSelection =
			"mode" in activeMonitor
				? activeMonitor
				: convertToMonitorSelection(activeMonitor);

		await this.sendCommand("resume_playlist", {
			activeMonitor: monitorSelection,
		});
	}

	async nextPlaylistImage(
		activeMonitor: ActiveMonitor | MonitorSelection,
	): Promise<void> {
		const monitorSelection =
			"mode" in activeMonitor
				? activeMonitor
				: convertToMonitorSelection(activeMonitor);

		await this.sendCommand("next_playlist_image", {
			activeMonitor: monitorSelection,
		});
	}

	async previousPlaylistImage(
		activeMonitor: ActiveMonitor | MonitorSelection,
	): Promise<void> {
		const monitorSelection =
			"mode" in activeMonitor
				? activeMonitor
				: convertToMonitorSelection(activeMonitor);

		await this.sendCommand("previous_playlist_image", {
			activeMonitor: monitorSelection,
		});
	}

	async getRunningPlaylists(): Promise<Record<string, RunningPlaylistInfo>> {
		return (await this.sendCommand(
			"get_running_playlists",
		)) as Record<string, RunningPlaylistInfo>;
	}

	// ============================================================================
	// IMAGE OPERATIONS
	// ============================================================================

	async getImages(filters?: unknown): Promise<JsonStoreImage[]> {
		return (await this.sendCommand("get_images", { filters })) as JsonStoreImage[];
	}

	async processImages(
		imagePaths: string[],
		fileNames: string[],
	): Promise<void> {
		await this.sendCommand("process_images", {
			imagePaths,
			fileNames,
		});
	}

	async deleteImages(imageIds: number[]): Promise<void> {
		await this.sendCommand("delete_images", { imageIds });
	}

	async upsertImage(image: ImageInfo): Promise<void> {
		await this.sendCommand("upsert_image", { image });
	}

	async getImageHistory(): Promise<ImageHistory[]> {
		return (await this.sendCommand("get_image_history")) as ImageHistory[];
	}

	async processForMonitors(
		imageId: number,
		activeMonitor: ActiveMonitor | MonitorSelection,
	): Promise<Record<string, string>> {
		const monitorSelection =
			"mode" in activeMonitor
				? activeMonitor
				: convertToMonitorSelection(activeMonitor);

		return (await this.sendCommand("process_for_monitors", {
			image: { id: imageId },
			activeMonitor: monitorSelection,
		})) as Record<string, string>;
	}

	// ============================================================================
	// CONFIGURATION OPERATIONS
	// ============================================================================

	async getConfig(): Promise<UnifiedConfig> {
		return (await this.sendCommand("get_config")) as UnifiedConfig;
	}

	async setConfig(
		section: string,
		key: string,
		value: unknown,
	): Promise<void> {
		await this.sendCommand("upsert_config", {
			config: {
				configSection: section,
				configKey: key,
				configValue: value,
			} as ConfigData,
		});
	}

	async setBulkConfig(config: Partial<UnifiedConfig>): Promise<void> {
		await this.sendCommand("upsert_config", {
			config: {
				frontendConfig: config,
			} as ConfigData,
		});
	}

	async setSelectedMonitor(
		activeMonitor: ActiveMonitor | MonitorSelection,
	): Promise<void> {
		const monitorSelection =
			"mode" in activeMonitor
				? activeMonitor
				: convertToMonitorSelection(activeMonitor);

		await this.sendCommand("set_selected_monitor", {
			activeMonitor: monitorSelection,
		});
	}

	async getSelectedMonitor(): Promise<MonitorSelection> {
		return (await this.sendCommand(
			"get_selected_monitor",
		)) as MonitorSelection;
	}

	// ============================================================================
	// MISCELLANEOUS OPERATIONS
	// ============================================================================

	async setImage(
		imageId: number,
		imageName: string,
		activeMonitor: ActiveMonitor | MonitorSelection | string,
	): Promise<void> {
		// Handle string input (legacy/mistake - convert to ActiveMonitor)
		if (typeof activeMonitor === "string") {
			// Get monitors to find the one with this name
			const monitors = await this.getMonitors();
			// Ensure monitors is an array
			const monitorsArray = Array.isArray(monitors) ? monitors : Object.values(monitors);
			const monitor = monitorsArray.find((m) => m.name === activeMonitor);
			if (!monitor) {
				throw new Error(`Monitor "${activeMonitor}" not found`);
			}
			activeMonitor = {
				monitors: [monitor],
				extendAcrossMonitors: false,
			};
		}

		const monitorSelection =
			"mode" in activeMonitor
				? activeMonitor
				: convertToMonitorSelection(activeMonitor);

		await this.sendCommand("set_image", {
			image: { id: imageId, name: imageName },
			activeMonitor: monitorSelection,
		});
	}

	async setImageAcrossMonitors(
		imageId: number,
		imageName: string,
		activeMonitor: ActiveMonitor | MonitorSelection,
	): Promise<void> {
		const monitorSelection =
			"mode" in activeMonitor
				? activeMonitor
				: convertToMonitorSelection(activeMonitor);

		await this.sendCommand("set_image_across_monitors", {
			image: { id: imageId, name: imageName },
			activeMonitor: monitorSelection,
		});
	}

	async nextImageHistory(
		activeMonitor: ActiveMonitor | MonitorSelection,
	): Promise<void> {
		const monitorSelection =
			"mode" in activeMonitor
				? activeMonitor
				: convertToMonitorSelection(activeMonitor);

		await this.sendCommand("next_image_history", {
			activeMonitor: monitorSelection,
		});
	}

	async previousImageHistory(
		activeMonitor: ActiveMonitor | MonitorSelection,
	): Promise<void> {
		const monitorSelection =
			"mode" in activeMonitor
				? activeMonitor
				: convertToMonitorSelection(activeMonitor);

		await this.sendCommand("previous_image_history", {
			activeMonitor: monitorSelection,
		});
	}

	async randomImage(
		activeMonitor: ActiveMonitor | MonitorSelection,
	): Promise<void> {
		const monitorSelection =
			"mode" in activeMonitor
				? activeMonitor
				: convertToMonitorSelection(activeMonitor);

		await this.sendCommand("random_image", {
			activeMonitor: monitorSelection,
		});
	}

	// ============================================================================
	// LEGACY COMPATIBILITY METHODS
	// ============================================================================

	/**
	 * @deprecated Use deleteImages instead
	 */
	async deleteImagesFromGallery(imageIds: number[]): Promise<void> {
		return this.deleteImages(imageIds);
	}

	/**
	 * @deprecated Use nextPlaylistImage instead
	 */
	async nextImage(activeMonitor: ActiveMonitor | MonitorSelection): Promise<void> {
		return this.nextPlaylistImage(activeMonitor);
	}

	/**
	 * @deprecated Use previousPlaylistImage instead
	 */
	async previousImage(activeMonitor: ActiveMonitor | MonitorSelection): Promise<void> {
		return this.previousPlaylistImage(activeMonitor);
	}

	/**
	 * @deprecated Use getRunningPlaylists instead
	 */
	async getActivePlaylist(
		activeMonitor: ActiveMonitor | MonitorSelection,
	): Promise<RunningPlaylistInfo | null> {
		const runningPlaylists = await this.getRunningPlaylists();
		const monitorSelection =
			"mode" in activeMonitor
				? activeMonitor
				: convertToMonitorSelection(activeMonitor);

		return runningPlaylists[monitorSelection.id] || null;
	}

	/**
	 * @deprecated Use getPlaylist instead
	 */
	async getPlaylistImages(playlistId: number): Promise<StoredPlaylist> {
		return this.getPlaylist(playlistId);
	}

	/**
	 * @deprecated Use setImageAcrossMonitors with mode: "clone" instead
	 */
	async duplicateImageAcrossMonitors(
		imageId: number,
		activeMonitor: ActiveMonitor | MonitorSelection,
	): Promise<void> {
		const monitorSelection =
			"mode" in activeMonitor
				? activeMonitor
				: convertToMonitorSelection(activeMonitor);

		// Force clone mode for duplication
		monitorSelection.mode = "clone";

		return this.setImage(imageId, monitorSelection);
	}

	/**
	 * @deprecated These methods don't exist in the new API
	 */
	async getAppConfig(): Promise<UnifiedConfig> {
		return this.getConfig();
	}

	async setAppConfig(config: Partial<UnifiedConfig>): Promise<void> {
		return this.setBulkConfig(config);
	}

	async getSwwwConfig(): Promise<UnifiedConfig["backend"]["swww"]> {
		const config = await this.getConfig();
		return config.backend.swww;
	}

	async setSwwwConfig(
		swwwConfig: UnifiedConfig["backend"]["swww"],
	): Promise<void> {
		await this.setBulkConfig({
			backend: {
				type: "swww",
				swww: swwwConfig,
			},
		});
	}

	async setFrontendConfig(config: Partial<UnifiedConfig>): Promise<void> {
		return this.setBulkConfig(config);
	}

	async getFrontendConfig(): Promise<UnifiedConfig> {
		return this.getConfig();
	}

	async getActivePlaylists(): Promise<Record<string, RunningPlaylistInfo>> {
		return this.getRunningPlaylists();
	}

	// Connection utilities
	disconnect(): void {
		if (this.socket) {
			this.socket.end();
			this.socket = null;
		}
		this.isConnected = false;
		this.subscribedEvents.clear();
		this.emit("disconnected");
	}

	isConnectedToDaemon(): boolean {
		return this.isConnected;
	}
}

// Singleton instance
export const goDaemonClient = new GoDaemonClient();
