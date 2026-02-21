import { create } from "zustand";
import type { Folder } from "../../electron/daemon-go-types";

const { goDaemon } = window.API_RENDERER;

interface FoldersState {
	folders: Folder[];
	breadcrumbPath: Folder[];
	currentFolderId: number | null;
	isLoading: boolean;
	searchResults: Folder[];

	fetchFolders: (parentId?: number | null) => Promise<void>;
	fetchBreadcrumbPath: (folderId: number | null) => Promise<void>;
	navigateToFolder: (folderId: number | null) => void;
	createFolder: (name: string, parentId?: number | null) => Promise<Folder>;
	renameFolder: (id: number, newName: string) => Promise<Folder>;
	deleteFolder: (
		id: number,
		mode: "keep_contents" | "delete_all",
	) => Promise<void>;
	moveImagesToFolder: (
		imageIds: number[],
		folderId: number | null,
	) => Promise<void>;
	searchFolders: (query: string) => Promise<void>;
	clearSearchResults: () => void;
}

export const useFoldersStore = create<FoldersState>()((set, get) => ({
	folders: [],
	breadcrumbPath: [],
	currentFolderId: null,
	isLoading: false,
	searchResults: [],

	fetchFolders: async (parentId?: number | null) => {
		set({ isLoading: true });
		try {
			const result = await goDaemon.getFolders(parentId);
			set({ folders: result.data || [], isLoading: false });
		} catch (error) {
			console.error("FoldersStore: Error fetching folders:", error);
			set({ folders: [], isLoading: false });
		}
	},

	fetchBreadcrumbPath: async (folderId: number | null) => {
		if (folderId === null) {
			set({ breadcrumbPath: [] });
			return;
		}
		try {
			const result = await goDaemon.getFolderPath(folderId);
			set({ breadcrumbPath: result.data || [] });
		} catch (error) {
			console.error("FoldersStore: Error fetching path:", error);
			set({ breadcrumbPath: [] });
		}
	},

	navigateToFolder: (folderId: number | null) => {
		set({ currentFolderId: folderId });
		get().fetchFolders(folderId);
		get().fetchBreadcrumbPath(folderId);
	},

	createFolder: async (name: string, parentId?: number | null) => {
		const folder = await goDaemon.createFolder(name, parentId);
		const { currentFolderId } = get();
		const targetParent = parentId !== undefined ? parentId : null;
		if (targetParent === currentFolderId) {
			set((state) => ({ folders: [...state.folders, folder] }));
		}
		return folder;
	},

	renameFolder: async (id: number, newName: string) => {
		const folder = await goDaemon.updateFolder(id, { name: newName });
		set((state) => ({
			folders: state.folders.map((f) => (f.id === id ? folder : f)),
			breadcrumbPath: state.breadcrumbPath.map((f) =>
				f.id === id ? folder : f,
			),
		}));
		return folder;
	},

	deleteFolder: async (
		id: number,
		mode: "keep_contents" | "delete_all",
	) => {
		await goDaemon.deleteFolder(id, mode);
		set((state) => ({
			folders: state.folders.filter((f) => f.id !== id),
		}));
	},

	moveImagesToFolder: async (
		imageIds: number[],
		folderId: number | null,
	) => {
		await goDaemon.moveImagesToFolder(imageIds, folderId);
	},

	searchFolders: async (query: string) => {
		if (!query.trim()) {
			set({ searchResults: [] });
			return;
		}
		try {
			const result = await goDaemon.getFolders(undefined, query);
			set({ searchResults: result.data || [] });
		} catch {
			set({ searchResults: [] });
		}
	},

	clearSearchResults: () => set({ searchResults: [] }),
}));
