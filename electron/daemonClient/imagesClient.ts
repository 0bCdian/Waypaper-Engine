import type {
  DeleteImagesRequest,
  ExtractVideoPaletteRequest,
  Image,
  ImageHistoryEntry,
  ImageQueryParams,
  ImportImagesRequest,
  ImportWebWallpaperRequest,
  PaginatedResponse,
  SelectAllImagesRequest,
  UpdateImageRequest,
  VideoLoopExportRequest,
  VideoLoopExportResult,
} from "../daemon-go-types";
import type { HttpTransport } from "./httpTransport";

export class ImagesClient {
  constructor(private readonly t: HttpTransport) {}

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
    if (params?.colors_near) query.set("colors_near", params.colors_near);
    if (params?.palette_similar_to !== undefined) {
      query.set("palette_similar_to", String(params.palette_similar_to));
    }
    if (params?.palette_max_delta_e !== undefined) {
      query.set("palette_max_delta_e", String(params.palette_max_delta_e));
    }
    if (params?.folder_id !== undefined) query.set("folder_id", String(params.folder_id));
    const qs = query.toString();
    const path = qs ? `/images?${qs}` : "/images";
    return this.t.request<PaginatedResponse<Image>>("GET", path);
  }

  async getImage(id: number): Promise<Image> {
    return this.t.request<Image>("GET", `/images/${id}`);
  }

  async ensureBrowserPreview(id: number, force?: boolean): Promise<Image> {
    const q = force ? "?force=1" : "";
    return this.t.request<Image>("POST", `/images/${id}/ensure-browser-preview${q}`);
  }

  async videoLoopExport(
    imageId: number,
    body: VideoLoopExportRequest,
  ): Promise<VideoLoopExportResult> {
    return this.t.request<VideoLoopExportResult>(
      "POST",
      `/images/${imageId}/video-loop-export`,
      body,
      900_000,
    );
  }

  async extractVideoPalette(
    imageId: number,
    body: ExtractVideoPaletteRequest,
  ): Promise<{ colors: string[]; image_id: number }> {
    return this.t.request<{ colors: string[]; image_id: number }>(
      "POST",
      `/images/${imageId}/extract-video-palette`,
      body,
      120_000,
    );
  }

  async getImageCount(): Promise<{ count: number }> {
    return this.t.request<{ count: number }>("GET", "/images/count");
  }

  async importImages(
    paths: string[],
    folderID?: number | null,
  ): Promise<{ status: string; total: number }> {
    const body: ImportImagesRequest = { paths };
    if (folderID !== undefined && folderID !== null) {
      body.folder_id = folderID;
    }
    return this.t.request<{ status: string; total: number }>("POST", "/images", body);
  }

  async importWebWallpaper(path: string, folderID?: number | null): Promise<Image> {
    const body: ImportWebWallpaperRequest = { path };
    if (folderID !== undefined && folderID !== null) {
      body.folder_id = folderID;
    }
    return this.t.request<Image>("POST", "/images/import-web", body);
  }

  async cancelImport(batchID: string): Promise<{ status: string; batch_id: string }> {
    return this.t.request<{ status: string; batch_id: string }>("POST", "/images/cancel-import", {
      batch_id: batchID,
    });
  }

  async deleteImages(ids: number[]): Promise<{ deleted: number }> {
    const body: DeleteImagesRequest = { ids };
    return this.t.request<{ deleted: number }>("DELETE", "/images", body);
  }

  async updateImage(id: number, update: UpdateImageRequest): Promise<Image> {
    return this.t.request<Image>("PATCH", `/images/${id}`, update);
  }

  async renameImage(id: number, name: string): Promise<Image> {
    return this.t.request<Image>("POST", `/images/${id}/rename`, { name });
  }

  async selectAllImages(selected: boolean): Promise<{ updated: number; selected: boolean }> {
    const body: SelectAllImagesRequest = { selected };
    return this.t.request<{ updated: number; selected: boolean }>(
      "POST",
      "/images/select-all",
      body,
    );
  }

  async getImageTags(): Promise<{ tags: string[] }> {
    return this.t.request<{ tags: string[] }>("GET", "/images/tags");
  }

  async getImageHistory(limit?: number, monitor?: string): Promise<ImageHistoryEntry[]> {
    const query = new URLSearchParams();
    if (limit) query.set("limit", String(limit));
    if (monitor) query.set("monitor", monitor);
    const qs = query.toString();
    const path = qs ? `/images/history?${qs}` : "/images/history";
    return this.t.request<ImageHistoryEntry[]>("GET", path);
  }

  async clearImageHistory(): Promise<{ status: string }> {
    return this.t.request<{ status: string }>("DELETE", "/images/history");
  }
}
