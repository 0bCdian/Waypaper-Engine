import type {
  MonitorMode,
  SetWallpaperRequest,
  SetWallpaperResponse,
  WallpaperCurrent,
} from "../daemon-go-types";
import type { HttpTransport } from "./httpTransport";

export class WallpaperClient {
  constructor(private readonly t: HttpTransport) {}

  async getCurrentWallpapers(): Promise<WallpaperCurrent> {
    return this.t.request<WallpaperCurrent>("GET", "/wallpaper/current");
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
    return this.t.request<SetWallpaperResponse>("POST", "/wallpaper/set", body);
  }

  async setRandomWallpaper(
    monitor: string = "*",
    mode: MonitorMode = "individual",
  ): Promise<SetWallpaperResponse> {
    return this.t.request<SetWallpaperResponse>("POST", "/wallpaper/random", {
      monitor,
      mode,
    });
  }
}
