import { createConnection, Socket } from "node:net";
import { EventEmitter } from "node:events";
import { logger } from "../globals/setup";
import type { 
    DaemonActivePlaylist, 
    DaemonImageHistory, 
    DaemonImage, 
    DaemonPlaylist, 
    DaemonMonitor,
    DaemonSwwwConfig
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
    // Real-time event fields
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

    constructor(socketPath: string = "/tmp/waypaper-engine.sock") {
        super();
        this.socketPath = socketPath;
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

                this.socket.on("data", data => {
                    this.handleMessage(data);
                });

                this.socket.on("error", error => {
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
        console.log(
            "🔴 GoDaemonClient: Received data from daemon:",
            data.toString()
        );
        // Add the new data to our buffer
        this.messageBuffer += data.toString();
        console.log(
            "🔴 GoDaemonClient: Current message buffer:",
            this.messageBuffer
        );

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
                const message = this.messageBuffer.substring(
                    startIndex,
                    endIndex
                );
                console.log("🔴 GoDaemonClient: Parsing message:", message);
                try {
                    const parsed: GoDaemonResponse = JSON.parse(message);
                    console.log("🔴 GoDaemonClient: Parsed response:", parsed);

                    // Handle ping/pong
                    if (parsed.action === "pong") {
                        this.emit("pong");
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
                        const { resolve, reject } =
                            this.pendingMessages.get(messageId)!;
                        this.pendingMessages.delete(messageId);

                        if (parsed.error) {
                            reject(new Error(parsed.error));
                        } else {
                            resolve(parsed.data);
                        }
                    }
                } catch (error) {
                    logger.error(
                        "Failed to parse message from Go daemon:",
                        error
                    );
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
        if (
            response &&
            typeof response === "object" &&
            "messageId" in response
        ) {
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
            `Attempting to reconnect to Go daemon (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
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
        console.log(
            "🔴 GoDaemonClient: sendCommand called with action:",
            action,
            "payload:",
            payload
        );
        console.log("🔴 GoDaemonClient: isConnected:", this.isConnected, "socket:", !!this.socket);
        if (!this.isConnected || !this.socket) {
            console.log("🔴 GoDaemonClient: Not connected to Go daemon");
            throw new Error("Not connected to Go daemon");
        }

        return new Promise((resolve, reject) => {
            const messageId = ++this.messageId;
            const message: GoDaemonMessage = {
                action,
                messageId,
                ...(payload && typeof payload === 'object' ? payload : {})
            };

            console.log(
                "🔴 GoDaemonClient: Sending message with ID:",
                messageId,
                "message:",
                message
            );
            this.pendingMessages.set(messageId, {
                resolve: value => {
                    console.log(
                        "🔴 GoDaemonClient: Message",
                        messageId,
                        "resolved with:",
                        value
                    );
                    resolve(value);
                },
                reject: error => {
                    console.log(
                        "🔴 GoDaemonClient: Message",
                        messageId,
                        "rejected with:",
                        error
                    );
                    reject(error);
                }
            });

            try {
                const messageStr = JSON.stringify(message) + "\n";
                console.log(
                    "🔴 GoDaemonClient: Writing to socket:",
                    messageStr.trim()
                );
                this.socket!.write(messageStr);
            } catch (error) {
                console.log(
                    "🔴 GoDaemonClient: Error writing to socket:",
                    error
                );
                this.pendingMessages.delete(messageId);
                reject(error);
            }
        });
    }

    // Image navigation commands

    async setImage(imageId: number, monitorName: string): Promise<boolean> {
        console.log(
            "🔵 GoDaemonClient: setImage called with imageId:",
            imageId,
            "monitorName:",
            monitorName
        );
        const payload = {
            image: { id: imageId },
            activeMonitor: { name: monitorName }
        };
        console.log("🔵 GoDaemonClient: setImage payload:", payload);
        return this.sendCommand("set_image", payload) as Promise<boolean>;
    }

    // Multi-monitor operations
    async setImageAcrossMonitors(
        imageId: number,
        activeMonitor: ActiveMonitor
    ): Promise<boolean> {
        console.log(
            "🔵 GoDaemonClient: setImageAcrossMonitors called with imageId:",
            imageId,
            "activeMonitor:",
            activeMonitor
        );
        const payload = {
            image: { id: imageId },
            activeMonitor
        };
        console.log(
            "🔵 GoDaemonClient: setImageAcrossMonitors payload:",
            payload
        );
        return this.sendCommand("set_image_across_monitors", payload) as Promise<boolean>;
    }

    async duplicateImageAcrossMonitors(
        imageId: number,
        activeMonitor: ActiveMonitor
    ): Promise<boolean> {
        console.log(
            "🔵 GoDaemonClient: duplicateImageAcrossMonitors called with imageId:",
            imageId,
            "activeMonitor:",
            activeMonitor
        );
        const payload = {
            image: { id: imageId },
            activeMonitor
        };
        console.log(
            "🔵 GoDaemonClient: duplicateImageAcrossMonitors payload:",
            payload
        );
        return this.sendCommand("duplicate_image_across_monitors", payload) as Promise<boolean>;
    }

    async processForMonitors(
        imageId: number,
        activeMonitor: ActiveMonitor
    ): Promise<boolean> {
        console.log(
            "🔵 GoDaemonClient: processForMonitors called with imageId:",
            imageId,
            "activeMonitor:",
            activeMonitor
        );
        const payload = {
            image: { id: imageId },
            activeMonitor
        };
        console.log("🔵 GoDaemonClient: processForMonitors payload:", payload);
        return this.sendCommand("process_for_monitors", payload) as Promise<boolean>;
    }

    async getMonitorImage(monitorName: string): Promise<string> {
        console.log(
            "🔵 GoDaemonClient: getMonitorImage called with monitorName:",
            monitorName
        );
        return this.sendCommand("get_monitor_image", { monitorName }) as Promise<string>;
    }

    // Data queries
    async getImages(filters?: unknown): Promise<DaemonImage[]> {
        return this.sendCommand("get_images", { filters }) as Promise<DaemonImage[]>;
    }

    async getPlaylists(): Promise<DaemonPlaylist[]> {
        return this.sendCommand("get_playlists") as Promise<DaemonPlaylist[]>;
    }

    async getActivePlaylist(activeMonitor: ActiveMonitor): Promise<DaemonActivePlaylist | null> {
        return await this.sendCommand("get_active_playlist", { activeMonitor }) as Promise<DaemonActivePlaylist | null>;
    }

    async getActivePlaylists(): Promise<DaemonActivePlaylist[]> {
        return await this.sendCommand("get_active_playlists") as Promise<DaemonActivePlaylist[]>;
    }

    async getImageHistory(): Promise<DaemonImageHistory[]> {
        return await this.sendCommand("get_image_history") as Promise<DaemonImageHistory[]>;
    }

    async getMonitors(): Promise<DaemonMonitor[]> {
        return await this.sendCommand("get_monitors") as Promise<DaemonMonitor[]>;
    }

    async savePlaylist(playlist: rendererPlaylist): Promise<boolean> {
        return await this.sendCommand("save_playlist", { playlist }) as Promise<boolean>;
    }

    async deletePlaylist(playlistName: string): Promise<boolean> {
        return await this.sendCommand("delete_playlist", { playlistName }) as Promise<boolean>;
    }

    async getPlaylistImages(playlistId: number): Promise<unknown> {
        return await this.sendCommand("get_playlist_images", { playlistId }) as Promise<unknown>;
    }

    async deleteImagesFromGallery(imageIds: number[]): Promise<boolean> {
        return await this.sendCommand("delete_image_from_gallery", {
            imageIds
        }) as Promise<boolean>;
    }

    async getDiagnostics(monitorName?: string): Promise<unknown> {
        return await this.sendCommand("get_diagnostics", { monitorName }) as Promise<unknown>;
    }

    // Playlist control methods
    async startPlaylist(
        playlistName: string,
        activeMonitor: ActiveMonitor
    ): Promise<boolean> {
        return await this.sendCommand("start_playlist", {
            playlistName,
            activeMonitor
        }) as Promise<boolean>;
    }

    async pausePlaylist(
        playlistName: string,
        activeMonitor: ActiveMonitor
    ): Promise<boolean> {
        return await this.sendCommand("pause_playlist", {
            playlistName,
            activeMonitor
        }) as Promise<boolean>;
    }

    async resumePlaylist(
        playlistName: string,
        activeMonitor: ActiveMonitor
    ): Promise<boolean> {
        return await this.sendCommand("resume_playlist", {
            playlistName,
            activeMonitor
        }) as Promise<boolean>;
    }

    async stopPlaylist(playlistName: string, activeMonitor: ActiveMonitor): Promise<boolean> {
        return await this.sendCommand("stop_playlist", {
            playlistName,
            activeMonitor
        }) as Promise<boolean>;
    }

    async stopPlaylistByName(playlistName: string): Promise<boolean> {
        return await this.sendCommand("stop_playlist_by_name", {
            playlistName
        }) as Promise<boolean>;
    }

    async stopPlaylistByMonitorName(monitors: string[]): Promise<boolean> {
        return await this.sendCommand("stop_playlist_by_monitor_name", {
            monitors
        }) as Promise<boolean>;
    }

    async stopPlaylistOnRemovedMonitors(): Promise<boolean> {
        return await this.sendCommand("stop_playlist_on_removed_monitors") as Promise<boolean>;
    }

    async nextImage(playlistName: string, activeMonitor: ActiveMonitor): Promise<boolean> {
        return await this.sendCommand("next_image", {
            playlistName,
            activeMonitor
        }) as Promise<boolean>;
    }

    async previousImage(
        playlistName: string,
        activeMonitor: ActiveMonitor
    ): Promise<boolean> {
        return await this.sendCommand("previous_image", {
            playlistName,
            activeMonitor
        }) as Promise<boolean>;
    }

    async randomImage(): Promise<boolean> {
        return await this.sendCommand("random_image") as Promise<boolean>;
    }

    async getInfo(): Promise<unknown> {
        return this.sendCommand("get_info") as Promise<unknown>;
    }

    async killDaemon(): Promise<boolean> {
        return this.sendCommand("kill_daemon") as Promise<boolean>;
    }

    async updateConfig(): Promise<boolean> {
        return this.sendCommand("update_config") as Promise<boolean>;
    }

    // Configuration commands
    async getAppConfig(): Promise<unknown> {
        return this.sendCommand("get_app_config") as Promise<unknown>;
    }

    async setAppConfig(_key: string, value: unknown): Promise<boolean> {
        return this.sendCommand("set_app_config", { 
            Config: { 
                AppConfig: value 
            } 
        }) as Promise<boolean>;
    }

    async getSwwwConfig(): Promise<DaemonSwwwConfig> {
        return this.sendCommand("get_swww_config") as Promise<DaemonSwwwConfig>;
    }

    async setSwwwConfig(config: DaemonSwwwConfig): Promise<boolean> {
        return this.sendCommand("set_swww_config", { 
            Config: { 
                SwwwConfig: config 
            } 
        }) as Promise<boolean>;
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

    // Bulk operations
    async nextImageAll(monitors?: string[]): Promise<boolean> {
        return this.sendCommand("next_image_all", { monitors }) as Promise<boolean>;
    }

    async previousImageAll(monitors?: string[]): Promise<boolean> {
        return this.sendCommand("previous_image_all", { monitors }) as Promise<boolean>;
    }

    async randomImageAll(monitors?: string[]): Promise<boolean> {
        return this.sendCommand("random_image_all", { monitors }) as Promise<boolean>;
    }

    async stopPlaylistAll(): Promise<boolean> {
        return this.sendCommand("stop_playlist_all") as Promise<boolean>;
    }

    async pausePlaylistAll(): Promise<boolean> {
        return this.sendCommand("pause_playlist_all") as Promise<boolean>;
    }

    async resumePlaylistAll(): Promise<boolean> {
        return this.sendCommand("resume_playlist_all") as Promise<boolean>;
    }

    // Monitor operations

    async setSelectedMonitor(activeMonitor: ActiveMonitor): Promise<boolean> {
        return await this.sendCommand("set_selected_monitor", {
            activeMonitor
        }) as Promise<boolean>;
    }

    async getSelectedMonitor(): Promise<unknown> {
        return await this.sendCommand("get_selected_monitor") as Promise<unknown>;
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
