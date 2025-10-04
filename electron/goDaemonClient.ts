import { createConnection, Socket } from "node:net";
import { EventEmitter } from "node:events";
import { logger } from "../globals/setup";

export interface GoDaemonMessage {
    action: string;
    data?: any;
    error?: string;
}

export interface GoDaemonResponse {
    action?: string;
    data?: any;
    error?: string;
    messageId?: number;
    // Real-time event fields
    type?: string;
    payload?: any;
}

export class GoDaemonClient extends EventEmitter {
    private socket: Socket | null = null;
    private socketPath: string;
    private isConnected: boolean = false;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 10;
    private reconnectInterval: number = 1000;
    private messageId: number = 0;
    private pendingMessages: Map<number, { resolve: (value: any) => void; reject: (error: any) => void }> = new Map();
    private messageBuffer: string = "";

    constructor(socketPath: string = "/tmp/waypaper_engine.sock") {
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
        console.log("🔴 GoDaemonClient: Received data from daemon:", data.toString());
        // Add the new data to our buffer
        this.messageBuffer += data.toString();
        console.log("🔴 GoDaemonClient: Current message buffer:", this.messageBuffer);
        
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
                
                if (char === '\\') {
                    escaped = true;
                    continue;
                }
                
                if (char === '"') {
                    inString = !inString;
                    continue;
                }
                
                if (!inString) {
                    if (char === '{') {
                        braceCount++;
                    } else if (char === '}') {
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
                    
                    if (eventType && (
                        eventType.startsWith("playlist_") || 
                        eventType.startsWith("wallpaper_") || 
                        eventType.startsWith("images_") ||
                        eventType.startsWith("config_") ||
                        eventType === "image_processed" ||
                        eventType === "image_error" ||
                        eventType === "processing_complete"
                    )) {
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
        if (response && typeof response === 'object' && 'messageId' in response) {
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
        logger.info(`Attempting to reconnect to Go daemon (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        setTimeout(async () => {
            try {
                await this.connect();
            } catch (error) {
                logger.error("Reconnection failed:", error);
            }
        }, this.reconnectInterval * this.reconnectAttempts);
    }

    async sendCommand(action: string, payload?: any): Promise<any> {
        console.log("🔴 GoDaemonClient: sendCommand called with action:", action, "payload:", payload);
        if (!this.isConnected || !this.socket) {
            console.log("🔴 GoDaemonClient: Not connected to Go daemon");
            throw new Error("Not connected to Go daemon");
        }

        return new Promise((resolve, reject) => {
            const messageId = ++this.messageId;
            const message: GoDaemonMessage = {
                action,
                messageId,
                ...payload
            };

            console.log("🔴 GoDaemonClient: Sending message with ID:", messageId, "message:", message);
            this.pendingMessages.set(messageId, { 
                resolve: (value) => {
                    console.log("🔴 GoDaemonClient: Message", messageId, "resolved with:", value);
                    resolve(value);
                }, 
                reject: (error) => {
                    console.log("🔴 GoDaemonClient: Message", messageId, "rejected with:", error);
                    reject(error);
                }
            });

            try {
                const messageStr = JSON.stringify(message) + '\n';
                console.log("🔴 GoDaemonClient: Writing to socket:", messageStr.trim());
                this.socket!.write(messageStr);
            } catch (error) {
                console.log("🔴 GoDaemonClient: Error writing to socket:", error);
                this.pendingMessages.delete(messageId);
                reject(error);
            }
        });
    }

    // Image navigation commands

    async setImage(imageId: number, monitorName: string): Promise<any> {
        console.log("🔵 GoDaemonClient: setImage called with imageId:", imageId, "monitorName:", monitorName);
        const payload = {
            image: { id: imageId },
            activeMonitor: { name: monitorName }
        };
        console.log("🔵 GoDaemonClient: setImage payload:", payload);
        return this.sendCommand("set_image", payload);
    }

    // Multi-monitor operations
    async setImageAcrossMonitors(imageId: number, activeMonitor: any): Promise<any> {
        console.log("🔵 GoDaemonClient: setImageAcrossMonitors called with imageId:", imageId, "activeMonitor:", activeMonitor);
        const payload = {
            image: { id: imageId },
            activeMonitor
        };
        console.log("🔵 GoDaemonClient: setImageAcrossMonitors payload:", payload);
        return this.sendCommand("set_image_across_monitors", payload);
    }

    async duplicateImageAcrossMonitors(imageId: number, activeMonitor: any): Promise<any> {
        console.log("🔵 GoDaemonClient: duplicateImageAcrossMonitors called with imageId:", imageId, "activeMonitor:", activeMonitor);
        const payload = {
            image: { id: imageId },
            activeMonitor
        };
        console.log("🔵 GoDaemonClient: duplicateImageAcrossMonitors payload:", payload);
        return this.sendCommand("duplicate_image_across_monitors", payload);
    }

    async processForMonitors(imageId: number, activeMonitor: any): Promise<any> {
        console.log("🔵 GoDaemonClient: processForMonitors called with imageId:", imageId, "activeMonitor:", activeMonitor);
        const payload = {
            image: { id: imageId },
            activeMonitor
        };
        console.log("🔵 GoDaemonClient: processForMonitors payload:", payload);
        return this.sendCommand("process_for_monitors", payload);
    }

    async getMonitorImage(monitorName: string): Promise<string> {
        console.log("🔵 GoDaemonClient: getMonitorImage called with monitorName:", monitorName);
        return this.sendCommand("get_monitor_image", { monitorName });
    }

    // Data queries
    async getImages(filters?: any): Promise<any> {
        return this.sendCommand("get_images", { filters });
    }

    async getPlaylists(): Promise<any> {
        return this.sendCommand("get_playlists");
    }

    async getActivePlaylist(activeMonitor: any): Promise<any> {
        return await this.sendCommand("get_active_playlist", { activeMonitor });
    }

    async savePlaylist(playlist: any): Promise<any> {
        return await this.sendCommand("save_playlist", { playlist });
    }

    async deletePlaylist(playlistName: string): Promise<any> {
        return await this.sendCommand("delete_playlist", { playlistName });
    }

    async getPlaylistImages(playlistId: number): Promise<any> {
        return await this.sendCommand("get_playlist_images", { playlistId });
    }

    async deleteImagesFromGallery(imageIds: number[]): Promise<any> {
        return await this.sendCommand("delete_image_from_gallery", { imageIds });
    }

    async getDiagnostics(monitorName?: string): Promise<any> {
        return await this.sendCommand("get_diagnostics", { monitorName });
    }

    // Playlist control methods
    async startPlaylist(playlistName: string, activeMonitor: any): Promise<any> {
        return await this.sendCommand("start_playlist", { playlistName, activeMonitor });
    }

    async pausePlaylist(playlistName: string, activeMonitor: any): Promise<any> {
        return await this.sendCommand("pause_playlist", { playlistName, activeMonitor });
    }

    async resumePlaylist(playlistName: string, activeMonitor: any): Promise<any> {
        return await this.sendCommand("resume_playlist", { playlistName, activeMonitor });
    }

    async stopPlaylist(playlistName: string, activeMonitor: any): Promise<any> {
        return await this.sendCommand("stop_playlist", { playlistName, activeMonitor });
    }

    async stopPlaylistByName(playlistName: string): Promise<any> {
        return await this.sendCommand("stop_playlist_by_name", { playlistName });
    }

    async stopPlaylistByMonitorName(monitors: string[]): Promise<any> {
        return await this.sendCommand("stop_playlist_by_monitor_name", { monitors });
    }

    async stopPlaylistOnRemovedMonitors(): Promise<any> {
        return await this.sendCommand("stop_playlist_on_removed_monitors");
    }

    async nextImage(playlistName: string, activeMonitor: any): Promise<any> {
        return await this.sendCommand("next_image", { playlistName, activeMonitor });
    }

    async previousImage(playlistName: string, activeMonitor: any): Promise<any> {
        return await this.sendCommand("previous_image", { playlistName, activeMonitor });
    }

    async randomImage(): Promise<any> {
        return await this.sendCommand("random_image");
    }

    async getInfo(): Promise<any> {
        return this.sendCommand("get_info");
    }

    async killDaemon(): Promise<any> {
        return this.sendCommand("kill_daemon");
    }

    async updateConfig(): Promise<any> {
        return this.sendCommand("update_config");
    }

    // Configuration commands
    async getAppConfig(): Promise<any> {
        return this.sendCommand("get_app_config");
    }

    async setAppConfig(key: string, value: any): Promise<any> {
        return this.sendCommand("set_app_config", { key, value });
    }

    async getSwwwConfig(): Promise<any> {
        return this.sendCommand("get_swww_config");
    }

    async setSwwwConfig(config: any): Promise<any> {
        return this.sendCommand("set_swww_config", config);
    }

    // System commands
    async ping(): Promise<any> {
        return this.sendCommand("ping");
    }

    async getDaemonStatus(): Promise<any> {
        return this.sendCommand("get_daemon_status");
    }

    async stopDaemon(): Promise<any> {
        return this.sendCommand("stop_daemon");
    }

    // Bulk operations
    async nextImageAll(monitors?: string[]): Promise<any> {
        return this.sendCommand("next_image_all", { monitors });
    }

    async previousImageAll(monitors?: string[]): Promise<any> {
        return this.sendCommand("previous_image_all", { monitors });
    }

    async randomImageAll(monitors?: string[]): Promise<any> {
        return this.sendCommand("random_image_all", { monitors });
    }

    async stopPlaylistAll(): Promise<any> {
        return this.sendCommand("stop_playlist_all");
    }

    async pausePlaylistAll(): Promise<any> {
        return this.sendCommand("pause_playlist_all");
    }

    async resumePlaylistAll(): Promise<any> {
        return this.sendCommand("resume_playlist_all");
    }

    // Monitor operations
    async getMonitors(): Promise<any> {
        console.log("🔴 GoDaemonClient: getMonitors() called");
        const result = await this.sendCommand("get_monitors");
        console.log("🔴 GoDaemonClient: getMonitors() result:", result);
        return result;
    }

    async setSelectedMonitor(activeMonitor: any): Promise<any> {
        return await this.sendCommand("set_selected_monitor", { activeMonitor });
    }

    async getSelectedMonitor(): Promise<any> {
        return await this.sendCommand("get_selected_monitor");
    }

    // Image source operations
    async getImageSrc(fileName: string): Promise<any> {
        return await this.sendCommand("get_image_src", {
            fileNames: [fileName]
        });
    }

    async getThumbnailSrc(fileName: string): Promise<any> {
        console.log("🔵 GoDaemonClient: getThumbnailSrc called with fileName:", fileName);
        const result = await this.sendCommand("get_thumbnail_src", {
            fileNames: [fileName]
        });
        console.log("🔵 GoDaemonClient: getThumbnailSrc result:", result);
        return result;
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