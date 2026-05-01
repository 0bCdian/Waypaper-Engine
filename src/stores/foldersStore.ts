import { create } from "zustand";
import type { Folder } from "../../electron/daemon-go-types";
import { getThumbnailSrc } from "../utils/utilities";
import { logger } from "../utils/logger";
import { daemonClient } from "@/client";

interface FoldersState {
  folders: Folder[];
  breadcrumbPath: Folder[];
  currentFolderId: number | null;
  isLoading: boolean;
  searchResults: Folder[];
  folderPreviews: Map<number, string[]>;

  fetchFolders: (parentId?: number | null) => Promise<void>;
  fetchFolderPreviews: (folderIds: number[]) => Promise<void>;
  invalidateFolderPreview: (folderId: number) => void;
  fetchBreadcrumbPath: (folderId: number | null) => Promise<void>;
  navigateToFolder: (folderId: number | null) => void;
  createFolder: (name: string, parentId?: number | null) => Promise<Folder>;
  renameFolder: (id: number, newName: string) => Promise<Folder>;
  deleteFolder: (id: number, mode: "keep_contents" | "delete_all") => Promise<void>;
  moveImagesToFolder: (imageIds: number[], folderId: number | null) => Promise<void>;
  searchFolders: (query: string) => Promise<void>;
  clearSearchResults: () => void;
}

export async function getAllImageIdsInFolder(folderId: number): Promise<number[]> {
  const ids: number[] = [];
  let page = 1;
  for (;;) {
    const res = await daemonClient.getImages({
      folder_id: folderId,
      per_page: 200,
      page,
    });
    for (const img of res.data) ids.push(img.id);
    if (page >= res.pagination.total_pages) break;
    page++;
  }
  return ids;
}

export const useFoldersStore = create<FoldersState>()((set, get) => ({
  folders: [],
  breadcrumbPath: [],
  currentFolderId: null,
  isLoading: false,
  searchResults: [],
  folderPreviews: new Map(),

  fetchFolders: async (parentId?: number | null) => {
    set({ isLoading: true });
    try {
      const result = await daemonClient.getFolders(parentId);
      const folders = result.data || [];
      set({ folders, isLoading: false });
      void get().fetchFolderPreviews(folders.map((f) => f.id));
    } catch (error) {
      logger.error("FoldersStore: Error fetching folders:", error);
      set({ folders: [], isLoading: false });
    }
  },

  fetchFolderPreviews: async (folderIds: number[]) => {
    const existing = get().folderPreviews;
    const toFetch = folderIds.filter((id) => !existing.has(id));
    if (toFetch.length === 0) return;
    const results = await Promise.all(
      toFetch.map(async (id) => {
        try {
          const res = await daemonClient.getImages({
            folder_id: id,
            per_page: 4,
            page: 1,
          });
          const thumbs = res.data.map((img) => getThumbnailSrc(img));
          return [id, thumbs] as const;
        } catch {
          return [id, [] as string[]] as const;
        }
      }),
    );
    set((state) => {
      const next = new Map(state.folderPreviews);
      for (const [id, thumbs] of results) next.set(id, thumbs);
      return { folderPreviews: next };
    });
  },

  invalidateFolderPreview: (folderId: number) => {
    set((state) => {
      const next = new Map(state.folderPreviews);
      next.delete(folderId);
      return { folderPreviews: next };
    });
  },

  fetchBreadcrumbPath: async (folderId: number | null) => {
    if (folderId === null) {
      set({ breadcrumbPath: [] });
      return;
    }
    try {
      const result = await daemonClient.getFolderPath(folderId);
      set({ breadcrumbPath: result.data || [] });
    } catch (error) {
      logger.error("FoldersStore: Error fetching path:", error);
      set({ breadcrumbPath: [] });
    }
  },

  navigateToFolder: (folderId: number | null) => {
    set({ currentFolderId: folderId });
    get().fetchFolders(folderId);
    get().fetchBreadcrumbPath(folderId);
  },

  createFolder: async (name: string, parentId?: number | null) => {
    const folder = await daemonClient.createFolder(name, parentId);
    const { currentFolderId } = get();
    const targetParent = parentId !== undefined ? parentId : null;
    if (targetParent === currentFolderId) {
      set((state) => ({ folders: [...state.folders, folder] }));
    }
    return folder;
  },

  renameFolder: async (id: number, newName: string) => {
    const folder = await daemonClient.updateFolder(id, { name: newName });
    set((state) => ({
      folders: state.folders.map((f) => (f.id === id ? folder : f)),
      breadcrumbPath: state.breadcrumbPath.map((f) => (f.id === id ? folder : f)),
    }));
    return folder;
  },

  deleteFolder: async (id: number, mode: "keep_contents" | "delete_all") => {
    await daemonClient.deleteFolder(id, mode);
    set((state) => ({
      folders: state.folders.filter((f) => f.id !== id),
    }));
  },

  moveImagesToFolder: async (imageIds: number[], folderId: number | null) => {
    await daemonClient.moveImagesToFolder(imageIds, folderId);
  },

  searchFolders: async (query: string) => {
    if (!query.trim()) {
      set({ searchResults: [] });
      return;
    }
    try {
      const result = await daemonClient.getFolders(undefined, query);
      set({ searchResults: result.data || [] });
    } catch {
      set({ searchResults: [] });
    }
  },

  clearSearchResults: () => set({ searchResults: [] }),
}));
