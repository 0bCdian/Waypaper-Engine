import { request as httpRequest, type IncomingMessage } from "node:http";
import { EventEmitter } from "node:events";
import { logger } from "./logger";
import { configReader } from "../globals/configReader";
import type {
  Image,
  ImageQueryParams,
  PaginatedResponse,
  ImageHistoryEntry,
  UpdateImageRequest,
  VideoLoopExportRequest,
  VideoLoopExportResult,
  Playlist,
  CreatePlaylistRequest,
  UpdatePlaylistRequest,
  ActivePlaylistInstance,
  Monitor,
  UnifiedConfig,
  BackendInfo,
  DaemonInfo,
  HealthResponse,
  SetWallpaperResponse,
  MonitorMode,
  WallpaperCurrent,
  EventType,
  Folder,
  UpdateFolderRequest,
} from "./daemon-go-types";
import { ControlPlaneClient } from "./daemonClient/controlPlaneClient";
import { FoldersClient } from "./daemonClient/foldersClient";
import { HealthClient } from "./daemonClient/healthClient";
import { HttpTransport } from "./daemonClient/httpTransport";
import { ImagesClient } from "./daemonClient/imagesClient";
import { MonitorsClient } from "./daemonClient/monitorsClient";
import { PlaylistsClient } from "./daemonClient/playlistsClient";
import { WallpaperClient } from "./daemonClient/wallpaperClient";

/**
 * Unix-socket client for the Go daemon: SSE fan-out plus JSON routes.
 * Domain logic lives in `./daemonClient/*Client`; this class keeps the stable
 * method surface for Electron and forwards to those modules.
 */
export class GoDaemonClient extends EventEmitter {
  private readonly http: HttpTransport;

  /** Control-plane routes (config, backends, activation). */
  readonly control: ControlPlaneClient;
  readonly health: HealthClient;
  readonly images: ImagesClient;
  readonly playlists: PlaylistsClient;
  readonly folders: FoldersClient;
  readonly monitors: MonitorsClient;
  readonly wallpaper: WallpaperClient;

  private sseConnection: IncomingMessage | null = null;
  private sseReconnectTimer: NodeJS.Timeout | null = null;
  private sseReconnectAttempts: number = 0;
  private sseBuffer: string = "";
  private isConnected: boolean = false;

  constructor(socketPath?: string) {
    super();
    const path = socketPath || configReader.getSocketPath();
    this.http = new HttpTransport(path);
    this.control = new ControlPlaneClient(this.http);
    this.health = new HealthClient(this.http);
    this.images = new ImagesClient(this.http);
    this.playlists = new PlaylistsClient(this.http);
    this.folders = new FoldersClient(this.http);
    this.monitors = new MonitorsClient(this.http);
    this.wallpaper = new WallpaperClient(this.http);
  }

  connectSSE(): void {
    if (this.sseConnection) {
      return;
    }

    const options = {
      socketPath: this.http.socket,
      path: "/events",
      method: "GET",
      headers: {
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
      },
    };

    const req = httpRequest(options, (res) => {
      if (this.sseReconnectTimer) {
        clearTimeout(this.sseReconnectTimer);
        this.sseReconnectTimer = null;
      }
      this.sseConnection = res;
      const wasReconnect = this.sseReconnectAttempts > 0;
      this.sseReconnectAttempts = 0;
      this.isConnected = true;
      this.sseBuffer = "";
      logger.info("SSE connection established");
      this.emit("connected");
      if (wasReconnect) {
        this.emit("sseReconnected");
      }

      res.on("data", (chunk: Buffer) => {
        this.handleSSEData(chunk.toString());
      });

      res.on("end", () => {
        logger.warn("SSE connection ended");
        this.sseConnection = null;
        this.isConnected = false;
        this.emit("disconnected");
        this.scheduleSseReconnect();
      });

      res.on("error", (error) => {
        logger.error({ err: error }, "SSE connection error");
        this.sseConnection = null;
        this.isConnected = false;
        this.emit("error", error);
        this.scheduleSseReconnect();
      });
    });

    req.on("error", (error) => {
      logger.error({ err: error }, "SSE request error");
      this.sseConnection = null;
      this.isConnected = false;
      this.emit("error", error);
      this.scheduleSseReconnect();
    });

    req.end();
  }

  private handleSSEData(chunk: string): void {
    this.sseBuffer += chunk;
    const lines = this.sseBuffer.split("\n");

    let currentEvent = "";
    let currentData = "";

    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i].trim();

      if (line === "") {
        if (currentEvent && currentData) {
          try {
            const payload = JSON.parse(currentData);
            this.emit(currentEvent as EventType, payload);
          } catch (error) {
            logger.error({ err: error, event: currentEvent }, "Failed to parse SSE event data");
          }
        }
        currentEvent = "";
        currentData = "";
      } else if (line.startsWith("event:")) {
        currentEvent = line.substring(6).trim();
      } else if (line.startsWith("data:")) {
        currentData = line.substring(5).trim();
      }
    }

    this.sseBuffer = lines[lines.length - 1];
  }

  private scheduleSseReconnect(): void {
    if (this.sseReconnectTimer) return;
    this.sseReconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, Math.min(this.sseReconnectAttempts - 1, 6)), 60000);

    if (this.sseReconnectAttempts === 1) {
      this.emit("sseDisconnected");
    }

    logger.info(`Scheduling SSE reconnect in ${delay}ms (attempt ${this.sseReconnectAttempts})`);

    this.sseReconnectTimer = setTimeout(() => {
      this.connectSSE();
    }, delay);
  }

  async connect(): Promise<void> {
    await this.healthCheck();
    this.connectSSE();
  }

  disconnect(): void {
    if (this.sseConnection) {
      this.sseConnection.destroy();
      this.sseConnection = null;
    }
    if (this.sseReconnectTimer) {
      clearTimeout(this.sseReconnectTimer);
      this.sseReconnectTimer = null;
    }
    this.isConnected = false;
    this.emit("disconnected");
  }

  isConnectedToDaemon(): boolean {
    return this.isConnected;
  }

  async healthCheck(): Promise<HealthResponse> {
    return this.health.healthCheck();
  }

  async ping(): Promise<boolean> {
    return this.health.ping();
  }

  async getInfo(): Promise<DaemonInfo> {
    return this.health.getInfo();
  }

  async getCapabilities(): Promise<{ ffmpeg_available: boolean }> {
    return this.health.getCapabilities();
  }

  async shutdown(): Promise<void> {
    return this.health.shutdown();
  }

  async getImages(params?: ImageQueryParams): Promise<PaginatedResponse<Image>> {
    return this.images.getImages(params);
  }

  async getImage(id: number): Promise<Image> {
    return this.images.getImage(id);
  }

  async ensureBrowserPreview(id: number, force?: boolean): Promise<Image> {
    return this.images.ensureBrowserPreview(id, force);
  }

  async videoLoopExport(
    imageId: number,
    body: VideoLoopExportRequest,
  ): Promise<VideoLoopExportResult> {
    return this.images.videoLoopExport(imageId, body);
  }

  async getImageCount(): Promise<{ count: number }> {
    return this.images.getImageCount();
  }

  async importImages(
    paths: string[],
    folderID?: number | null,
  ): Promise<{ status: string; total: number }> {
    return this.images.importImages(paths, folderID);
  }

  async importWebWallpaper(path: string, folderID?: number | null): Promise<Image> {
    return this.images.importWebWallpaper(path, folderID);
  }

  async cancelImport(batchID: string): Promise<{ status: string; batch_id: string }> {
    return this.images.cancelImport(batchID);
  }

  async deleteImages(ids: number[]): Promise<{ deleted: number }> {
    return this.images.deleteImages(ids);
  }

  async updateImage(id: number, update: UpdateImageRequest): Promise<Image> {
    return this.images.updateImage(id, update);
  }

  async renameImage(id: number, name: string): Promise<Image> {
    return this.images.renameImage(id, name);
  }

  async selectAllImages(selected: boolean): Promise<{ updated: number; selected: boolean }> {
    return this.images.selectAllImages(selected);
  }

  async getImageTags(): Promise<{ tags: string[] }> {
    return this.images.getImageTags();
  }

  async getImageHistory(limit?: number, monitor?: string): Promise<ImageHistoryEntry[]> {
    return this.images.getImageHistory(limit, monitor);
  }

  async clearImageHistory(): Promise<{ status: string }> {
    return this.images.clearImageHistory();
  }

  async getCurrentWallpapers(): Promise<WallpaperCurrent> {
    return this.wallpaper.getCurrentWallpapers();
  }

  async setWallpaper(
    imageId: number,
    monitor: string = "*",
    mode: MonitorMode = "individual",
    monitors?: string[],
  ): Promise<SetWallpaperResponse> {
    return this.wallpaper.setWallpaper(imageId, monitor, mode, monitors);
  }

  async setRandomWallpaper(
    monitor: string = "*",
    mode: MonitorMode = "individual",
  ): Promise<SetWallpaperResponse> {
    return this.wallpaper.setRandomWallpaper(monitor, mode);
  }

  async getPlaylists(): Promise<Playlist[]> {
    return this.playlists.getPlaylists();
  }

  async getPlaylist(id: number): Promise<Playlist> {
    return this.playlists.getPlaylist(id);
  }

  async createPlaylist(playlist: CreatePlaylistRequest): Promise<Playlist> {
    return this.playlists.createPlaylist(playlist);
  }

  async updatePlaylist(id: number, update: UpdatePlaylistRequest): Promise<Playlist> {
    return this.playlists.updatePlaylist(id, update);
  }

  async deletePlaylist(id: number): Promise<void> {
    return this.playlists.deletePlaylist(id);
  }

  async startPlaylist(
    id: number,
    monitor: string = "*",
    mode: MonitorMode = "individual",
  ): Promise<void> {
    return this.playlists.startPlaylist(id, monitor, mode);
  }

  async stopPlaylist(id: number): Promise<void> {
    return this.playlists.stopPlaylist(id);
  }

  async pausePlaylist(id: number): Promise<void> {
    return this.playlists.pausePlaylist(id);
  }

  async resumePlaylist(id: number): Promise<void> {
    return this.playlists.resumePlaylist(id);
  }

  async nextPlaylistImage(id: number): Promise<void> {
    return this.playlists.nextPlaylistImage(id);
  }

  async previousPlaylistImage(id: number): Promise<void> {
    return this.playlists.previousPlaylistImage(id);
  }

  async getActivePlaylists(): Promise<ActivePlaylistInstance[]> {
    return this.playlists.getActivePlaylists();
  }

  async getActivePlaylistForMonitor(monitor: string): Promise<ActivePlaylistInstance> {
    return this.playlists.getActivePlaylistForMonitor(monitor);
  }

  async stopAllPlaylists(): Promise<{ message: string; stopped: number }> {
    return this.playlists.stopAllPlaylists();
  }

  async pauseAllPlaylists(): Promise<{ message: string; paused: number }> {
    return this.playlists.pauseAllPlaylists();
  }

  async resumeAllPlaylists(): Promise<{
    message: string;
    resumed: number;
  }> {
    return this.playlists.resumeAllPlaylists();
  }

  async nextAllPlaylists(): Promise<{ message: string; advanced: number }> {
    return this.playlists.nextAllPlaylists();
  }

  async previousAllPlaylists(): Promise<{
    message: string;
    reversed: number;
  }> {
    return this.playlists.previousAllPlaylists();
  }

  async getFolders(parentId?: number | null, search?: string): Promise<{ data: Folder[] }> {
    return this.folders.getFolders(parentId, search);
  }

  async getFolder(id: number): Promise<Folder> {
    return this.folders.getFolder(id);
  }

  async getFolderPath(id: number): Promise<{ data: Folder[] }> {
    return this.folders.getFolderPath(id);
  }

  async createFolder(name: string, parentId?: number | null): Promise<Folder> {
    return this.folders.createFolder(name, parentId);
  }

  async updateFolder(id: number, update: UpdateFolderRequest): Promise<Folder> {
    return this.folders.updateFolder(id, update);
  }

  async deleteFolder(
    id: number,
    mode: "keep_contents" | "delete_all" = "keep_contents",
  ): Promise<{ deleted: boolean; mode: string }> {
    return this.folders.deleteFolder(id, mode);
  }

  async moveImagesToFolder(
    imageIds: number[],
    folderId: number | null,
  ): Promise<{ moved: number }> {
    return this.folders.moveImagesToFolder(imageIds, folderId);
  }

  async getMonitors(): Promise<Monitor[]> {
    return this.monitors.getMonitors();
  }

  async getMonitor(name: string): Promise<Monitor> {
    return this.monitors.getMonitor(name);
  }

  async getConfig(): Promise<UnifiedConfig> {
    return this.control.getConfig();
  }

  async updateConfig(config: Partial<UnifiedConfig>): Promise<UnifiedConfig> {
    return this.control.updateConfig(config);
  }

  async getConfigSection(section: string): Promise<unknown> {
    return this.control.getConfigSection(section);
  }

  async updateConfigSection(section: string, data: Record<string, unknown>): Promise<unknown> {
    return this.control.updateConfigSection(section, data);
  }

  async getBackendConfig(name: string): Promise<Record<string, unknown>> {
    return this.control.getBackendConfig(name);
  }

  async updateBackendConfig(name: string, patch: Record<string, unknown>): Promise<void> {
    return this.control.updateBackendConfig(name, patch);
  }

  async getBackends(): Promise<BackendInfo[]> {
    return this.control.getBackends();
  }

  async activateBackend(name: string): Promise<{ status: string; backend: string }> {
    return this.control.activateBackend(name);
  }
}

export const goDaemonClient = new GoDaemonClient();
