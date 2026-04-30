import type {
  ActivePlaylistInstance,
  CreatePlaylistRequest,
  MonitorMode,
  Playlist,
  StartPlaylistRequest,
  UpdatePlaylistRequest,
} from "../daemon-go-types";
import type { HttpTransport } from "./httpTransport";

export class PlaylistsClient {
  constructor(private readonly t: HttpTransport) {}

  async getPlaylists(): Promise<Playlist[]> {
    return this.t.request<Playlist[]>("GET", "/playlists");
  }

  async getPlaylist(id: number): Promise<Playlist> {
    return this.t.request<Playlist>("GET", `/playlists/${id}`);
  }

  async createPlaylist(playlist: CreatePlaylistRequest): Promise<Playlist> {
    return this.t.request<Playlist>("POST", "/playlists", playlist);
  }

  async updatePlaylist(id: number, update: UpdatePlaylistRequest): Promise<Playlist> {
    return this.t.request<Playlist>("PATCH", `/playlists/${id}`, update);
  }

  async deletePlaylist(id: number): Promise<void> {
    await this.t.request("DELETE", `/playlists/${id}`);
  }

  async startPlaylist(
    id: number,
    monitor: string = "*",
    mode: MonitorMode = "individual",
  ): Promise<void> {
    const body: StartPlaylistRequest = {
      monitor: { id: monitor, mode },
    };
    await this.t.request("POST", `/playlists/${id}/start`, body);
  }

  async stopPlaylist(id: number): Promise<void> {
    await this.t.request("POST", `/playlists/${id}/stop`);
  }

  async pausePlaylist(id: number): Promise<void> {
    await this.t.request("POST", `/playlists/${id}/pause`);
  }

  async resumePlaylist(id: number): Promise<void> {
    await this.t.request("POST", `/playlists/${id}/resume`);
  }

  async nextPlaylistImage(id: number): Promise<void> {
    await this.t.request("POST", `/playlists/${id}/next`);
  }

  async previousPlaylistImage(id: number): Promise<void> {
    await this.t.request("POST", `/playlists/${id}/previous`);
  }

  async getActivePlaylists(): Promise<ActivePlaylistInstance[]> {
    return this.t.request<ActivePlaylistInstance[]>("GET", "/playlists/active");
  }

  async getActivePlaylistForMonitor(monitor: string): Promise<ActivePlaylistInstance> {
    return this.t.request<ActivePlaylistInstance>(
      "GET",
      `/playlists/active/${encodeURIComponent(monitor)}`,
    );
  }

  async stopAllPlaylists(): Promise<{ message: string; stopped: number }> {
    return this.t.request("POST", "/playlists/active/stop");
  }

  async pauseAllPlaylists(): Promise<{ message: string; paused: number }> {
    return this.t.request("POST", "/playlists/active/pause");
  }

  async resumeAllPlaylists(): Promise<{
    message: string;
    resumed: number;
  }> {
    return this.t.request("POST", "/playlists/active/resume");
  }

  async nextAllPlaylists(): Promise<{ message: string; advanced: number }> {
    return this.t.request("POST", "/playlists/active/next");
  }

  async previousAllPlaylists(): Promise<{
    message: string;
    reversed: number;
  }> {
    return this.t.request("POST", "/playlists/active/previous");
  }
}
