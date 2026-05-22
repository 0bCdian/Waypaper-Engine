import type {
  CreateFolderRequest,
  Folder,
  MoveImagesRequest,
  UpdateFolderRequest,
} from "../daemon-go-types";
import type { HttpTransport } from "./httpTransport";

export class FoldersClient {
  constructor(private readonly t: HttpTransport) {}

  async getFolders(parentId?: number | null, search?: string): Promise<{ data: Folder[] }> {
    const query = new URLSearchParams();
    if (parentId !== undefined && parentId !== null) {
      query.set("parent_id", String(parentId));
    }
    if (search) query.set("search", search);
    const qs = query.toString();
    const path = qs ? `/folders?${qs}` : "/folders";
    return this.t.request<{ data: Folder[] }>("GET", path);
  }

  async getFolder(id: number): Promise<Folder> {
    return this.t.request<Folder>("GET", `/folders/${id}`);
  }

  async getFolderPath(id: number): Promise<{ data: Folder[] }> {
    return this.t.request<{ data: Folder[] }>("GET", `/folders/${id}/path`);
  }

  async createFolder(name: string, parentId?: number | null): Promise<Folder> {
    const body: CreateFolderRequest = { name };
    if (parentId !== undefined && parentId !== null) {
      body.parent_id = parentId;
    }
    return this.t.request<Folder>("POST", "/folders", body);
  }

  async updateFolder(id: number, update: UpdateFolderRequest): Promise<Folder> {
    return this.t.request<Folder>("PATCH", `/folders/${id}`, update);
  }

  async deleteFolder(
    id: number,
    mode: "keep_contents" | "delete_all" = "keep_contents",
  ): Promise<{ deleted: boolean; mode: string }> {
    return this.t.request<{ deleted: boolean; mode: string }>(
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
    return this.t.request<{ moved: number }>("POST", "/folders/move-images", body);
  }
}
