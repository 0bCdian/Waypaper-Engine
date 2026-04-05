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
  ImportImagesRequest,
  ImportWebWallpaperRequest,
  DeleteImagesRequest,
  SelectAllImagesRequest,
  Playlist,
  CreatePlaylistRequest,
  UpdatePlaylistRequest,
  ActivePlaylistInstance,
  StartPlaylistRequest,
  Monitor,
  UnifiedConfig,
  BackendInfo,
  DaemonInfo,
  HealthResponse,
  SetWallpaperRequest,
  SetWallpaperResponse,
  MonitorMode,
  MonitorState,
  EventType,
  Folder,
  CreateFolderRequest,
  UpdateFolderRequest,
  MoveImagesRequest,
} from "./daemon-go-types";

export class GoDaemonClient extends EventEmitter {
  private socketPath: string;
  private sseConnection: IncomingMessage | null = null;
  private sseReconnectTimer: NodeJS.Timeout | null = null;
  private sseReconnectAttempts: number = 0;
  private sseBuffer: string = "";
  private isConnected: boolean = false;

  constructor(socketPath?: string) {
    super();
    this.socketPath = socketPath || configReader.getSocketPath();
  }

  private request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      const options = {
        socketPath: this.socketPath,
        path,
        method,
        headers: {
          "Content-Type": "application/json",
        },
      };

      const req = httpRequest(options, (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on("end", () => {
          try {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              if (data.trim() === "") {
                resolve(undefined as T);
              } else {
                resolve(JSON.parse(data) as T);
              }
            } else {
              const errorData = data ? JSON.parse(data) : { error: `HTTP ${res.statusCode}` };
              reject(new Error(errorData.error || `HTTP ${res.statusCode}`));
            }
          } catch (parseError) {
            reject(new Error(`Failed to parse response: ${parseError}`));
          }
        });
      });

      req.on("error", (error) => {
        reject(error);
      });

      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error(`Request timeout: ${method} ${path}`));
      });

      if (body !== undefined) {
        const jsonBody = JSON.stringify(body);
        req.setHeader("Content-Length", Buffer.byteLength(jsonBody));
        req.write(jsonBody);
      }

      req.end();
    });
  }

  connectSSE(): void {
    if (this.sseConnection) {
      return;
    }

    const options = {
      socketPath: this.socketPath,
      path: "/events",
      method: "GET",
      headers: {
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
      },
    };

    const req = httpRequest(options, (res) => {
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
        // Empty line signals end of event
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

    // Keep the last incomplete line in the buffer
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
    // Test the connection with a health check
    await this.healthCheck();
    // Start SSE connection for events
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
    return this.request<HealthResponse>("GET", "/healthz");
  }

  async ping(): Promise<boolean> {
    try {
      await this.healthCheck();
      return true;
    } catch {
      return false;
    }
  }

  async getInfo(): Promise<DaemonInfo> {
    return this.request<DaemonInfo>("GET", "/info");
  }

  async shutdown(): Promise<void> {
    await this.request("POST", "/shutdown");
  }

  async getImages(params?: ImageQueryParams): Promise<PaginatedResponse<Image>> {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.per_page) query.set("per_page", String(params.per_page));
    if (params?.sort_by) query.set("sort_by", params.sort_by);
    if (params?.sort_order) query.set("sort_order", params.sort_order);
    if (params?.media_type) query.set("media_type", params.media_type);
    if (params?.search) query.set("search", params.search);
    if (params?.tags) query.set("tags", params.tags);
    if (params?.colors) query.set("colors", params.colors);
    if (params?.folder_id !== undefined) query.set("folder_id", String(params.folder_id));
    const qs = query.toString();
    const path = qs ? `/images?${qs}` : "/images";
    return this.request<PaginatedResponse<Image>>("GET", path);
  }

  async getImage(id: number): Promise<Image> {
    return this.request<Image>("GET", `/images/${id}`);
  }

  async ensureBrowserPreview(id: number, force?: boolean): Promise<Image> {
    const q = force ? "?force=1" : "";
    return this.request<Image>("POST", `/images/${id}/ensure-browser-preview${q}`);
  }

  async getImageCount(): Promise<{ count: number }> {
    return this.request<{ count: number }>("GET", "/images/count");
  }

  async importImages(
    paths: string[],
    folderID?: number | null,
  ): Promise<{ status: string; total: number }> {
    const body: ImportImagesRequest = { paths };
    if (folderID !== undefined && folderID !== null) {
      body.folder_id = folderID;
    }
    return this.request<{ status: string; total: number }>("POST", "/images", body);
  }

  async importWebWallpaper(path: string, folderID?: number | null): Promise<Image> {
    const body: ImportWebWallpaperRequest = { path };
    if (folderID !== undefined && folderID !== null) {
      body.folder_id = folderID;
    }
    return this.request<Image>("POST", "/images/import-web", body);
  }

  async cancelImport(batchID: string): Promise<{ status: string; batch_id: string }> {
    return this.request<{ status: string; batch_id: string }>("POST", "/images/cancel-import", {
      batch_id: batchID,
    });
  }

  async deleteImages(ids: number[]): Promise<{ deleted: number }> {
    const body: DeleteImagesRequest = { ids };
    return this.request<{ deleted: number }>("DELETE", "/images", body);
  }

  async updateImage(id: number, update: UpdateImageRequest): Promise<Image> {
    return this.request<Image>("PATCH", `/images/${id}`, update);
  }

  async renameImage(id: number, name: string): Promise<Image> {
    return this.request<Image>("POST", `/images/${id}/rename`, { name });
  }

  async selectAllImages(selected: boolean): Promise<{ updated: number; selected: boolean }> {
    const body: SelectAllImagesRequest = { selected };
    return this.request<{ updated: number; selected: boolean }>("POST", "/images/select-all", body);
  }

  async getImageTags(): Promise<{ tags: string[] }> {
    return this.request<{ tags: string[] }>("GET", "/images/tags");
  }

  async getImageHistory(limit?: number, monitor?: string): Promise<ImageHistoryEntry[]> {
    const query = new URLSearchParams();
    if (limit) query.set("limit", String(limit));
    if (monitor) query.set("monitor", monitor);
    const qs = query.toString();
    const path = qs ? `/images/history?${qs}` : "/images/history";
    return this.request<ImageHistoryEntry[]>("GET", path);
  }

  async clearImageHistory(): Promise<{ status: string }> {
    return this.request<{ status: string }>("DELETE", "/images/history");
  }

  async getCurrentWallpapers(): Promise<MonitorState[]> {
    return this.request<MonitorState[]>("GET", "/wallpaper/current");
  }

  async setWallpaper(
    imageId: number,
    monitor: string = "*",
    mode: MonitorMode = "individual",
    monitors?: string[],
  ): Promise<SetWallpaperResponse> {
    const body: SetWallpaperRequest = {
      image_id: imageId,
      monitor,
      mode,
      monitors,
    };
    return this.request<SetWallpaperResponse>("POST", "/wallpaper/set", body);
  }

  async setRandomWallpaper(
    monitor: string = "*",
    mode: MonitorMode = "individual",
  ): Promise<SetWallpaperResponse> {
    return this.request<SetWallpaperResponse>("POST", "/wallpaper/random", {
      monitor,
      mode,
    });
  }

  async getPlaylists(): Promise<Playlist[]> {
    return this.request<Playlist[]>("GET", "/playlists");
  }

  async getPlaylist(id: number): Promise<Playlist> {
    return this.request<Playlist>("GET", `/playlists/${id}`);
  }

  async createPlaylist(playlist: CreatePlaylistRequest): Promise<Playlist> {
    return this.request<Playlist>("POST", "/playlists", playlist);
  }

  async updatePlaylist(id: number, update: UpdatePlaylistRequest): Promise<Playlist> {
    return this.request<Playlist>("PATCH", `/playlists/${id}`, update);
  }

  async deletePlaylist(id: number): Promise<void> {
    await this.request("DELETE", `/playlists/${id}`);
  }

  async startPlaylist(
    id: number,
    monitor: string = "*",
    mode: MonitorMode = "individual",
  ): Promise<void> {
    const body: StartPlaylistRequest = {
      monitor: { id: monitor, mode },
    };
    await this.request("POST", `/playlists/${id}/start`, body);
  }

  async stopPlaylist(id: number): Promise<void> {
    await this.request("POST", `/playlists/${id}/stop`);
  }

  async pausePlaylist(id: number): Promise<void> {
    await this.request("POST", `/playlists/${id}/pause`);
  }

  async resumePlaylist(id: number): Promise<void> {
    await this.request("POST", `/playlists/${id}/resume`);
  }

  async nextPlaylistImage(id: number): Promise<void> {
    await this.request("POST", `/playlists/${id}/next`);
  }

  async previousPlaylistImage(id: number): Promise<void> {
    await this.request("POST", `/playlists/${id}/previous`);
  }

  async getActivePlaylists(): Promise<ActivePlaylistInstance[]> {
    return this.request<ActivePlaylistInstance[]>("GET", "/playlists/active");
  }

  async getActivePlaylistForMonitor(monitor: string): Promise<ActivePlaylistInstance> {
    return this.request<ActivePlaylistInstance>(
      "GET",
      `/playlists/active/${encodeURIComponent(monitor)}`,
    );
  }

  // Bulk playlist actions
  async stopAllPlaylists(): Promise<{ message: string; stopped: number }> {
    return this.request("POST", "/playlists/active/stop");
  }

  async pauseAllPlaylists(): Promise<{ message: string; paused: number }> {
    return this.request("POST", "/playlists/active/pause");
  }

  async resumeAllPlaylists(): Promise<{
    message: string;
    resumed: number;
  }> {
    return this.request("POST", "/playlists/active/resume");
  }

  async nextAllPlaylists(): Promise<{ message: string; advanced: number }> {
    return this.request("POST", "/playlists/active/next");
  }

  async previousAllPlaylists(): Promise<{
    message: string;
    reversed: number;
  }> {
    return this.request("POST", "/playlists/active/previous");
  }

  async getFolders(parentId?: number | null, search?: string): Promise<{ data: Folder[] }> {
    const query = new URLSearchParams();
    if (parentId !== undefined && parentId !== null) {
      query.set("parent_id", String(parentId));
    }
    if (search) query.set("search", search);
    const qs = query.toString();
    const path = qs ? `/folders?${qs}` : "/folders";
    return this.request<{ data: Folder[] }>("GET", path);
  }

  async getFolder(id: number): Promise<Folder> {
    return this.request<Folder>("GET", `/folders/${id}`);
  }

  async getFolderPath(id: number): Promise<{ data: Folder[] }> {
    return this.request<{ data: Folder[] }>("GET", `/folders/${id}/path`);
  }

  async createFolder(name: string, parentId?: number | null): Promise<Folder> {
    const body: CreateFolderRequest = { name };
    if (parentId !== undefined && parentId !== null) {
      body.parent_id = parentId;
    }
    return this.request<Folder>("POST", "/folders", body);
  }

  async updateFolder(id: number, update: UpdateFolderRequest): Promise<Folder> {
    return this.request<Folder>("PATCH", `/folders/${id}`, update);
  }

  async deleteFolder(
    id: number,
    mode: "keep_contents" | "delete_all" = "keep_contents",
  ): Promise<{ deleted: boolean; mode: string }> {
    return this.request<{ deleted: boolean; mode: string }>(
      "DELETE",
      `/folders/${id}?mode=${mode}`,
    );
  }

  async moveImagesToFolder(
    imageIds: number[],
    folderId: number | null,
  ): Promise<{ moved: number }> {
    const body: MoveImagesRequest = {
      image_ids: imageIds,
      folder_id: folderId,
    };
    return this.request<{ moved: number }>("POST", "/folders/move-images", body);
  }

  async getMonitors(): Promise<Monitor[]> {
    return this.request<Monitor[]>("GET", "/monitors");
  }

  async getMonitor(name: string): Promise<Monitor> {
    return this.request<Monitor>("GET", `/monitors/${encodeURIComponent(name)}`);
  }

  async getConfig(): Promise<UnifiedConfig> {
    return this.request<UnifiedConfig>("GET", "/config");
  }

  async updateConfig(config: Partial<UnifiedConfig>): Promise<UnifiedConfig> {
    return this.request<UnifiedConfig>("PATCH", "/config", config);
  }

  async getConfigSection(section: string): Promise<unknown> {
    return this.request("GET", `/config/${section}`);
  }

  async updateConfigSection(section: string, data: Record<string, unknown>): Promise<unknown> {
    return this.request("PATCH", `/config/${section}`, data);
  }

  async getBackendConfig(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("GET", "/config/backend");
  }

  async updateBackendConfig(config: Record<string, unknown>): Promise<void> {
    await this.request("PATCH", "/config/backend", config);
  }

  async getBackends(): Promise<BackendInfo[]> {
    return this.request<BackendInfo[]>("GET", "/backends");
  }

  async activateBackend(name: string): Promise<{ status: string; backend: string }> {
    return this.request<{ status: string; backend: string }>(
      "POST",
      `/backends/${encodeURIComponent(name)}/activate`,
    );
  }
}

// Singleton instance
export const goDaemonClient = new GoDaemonClient();
