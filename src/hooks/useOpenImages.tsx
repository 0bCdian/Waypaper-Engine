import { create } from "zustand";
import type { openFileAction } from "../../shared/types";
import { useFoldersStore } from "../stores/foldersStore";

const { openFiles, handleOpenImages } = window.API_RENDERER;

interface PendingFolderImport {
	files: string[];
	folderName: string;
}

interface State {
	isActive: boolean;
	pendingFolderImport: PendingFolderImport | null;
}

interface openImagesProps {
	action: openFileAction;
}

interface Actions {
	openImages: (openImagesProps: openImagesProps) => Promise<void>;
	confirmFolderImport: (createFolder: boolean) => Promise<void>;
	cancelFolderImport: () => void;
}

const openImagesStore = create<State & Actions>((set, get) => ({
	isActive: false,
	pendingFolderImport: null,

	openImages: async ({ action }) => {
		set(() => ({ isActive: true }));

		const result = await openFiles(action);

		set(() => ({ isActive: false }));

		if (!result.success) {
			return;
		}

		const files = result.data?.files || result.files || [];

		if (files.length === 0) {
			return;
		}

		if (action === "folder" && result.folderName) {
			set({
				pendingFolderImport: {
					files,
					folderName: result.folderName,
				},
			});
			return;
		}

		const currentFolderId = useFoldersStore.getState().currentFolderId;
		const imagesObject = {
			success: true,
			data: {
				files,
				folder_id: currentFolderId ?? undefined,
			},
		};

		try {
			await handleOpenImages(imagesObject);
		} catch (error) {
			console.error("useOpenImages: Error calling handleOpenImages:", error);
		}
	},

	confirmFolderImport: async (createFolder: boolean) => {
		const pending = get().pendingFolderImport;
		if (!pending) return;

		set({ pendingFolderImport: null });
		const currentFolderId = useFoldersStore.getState().currentFolderId;

		if (createFolder) {
			try {
				const folder = await useFoldersStore
					.getState()
					.createFolder(pending.folderName, currentFolderId);
				await handleOpenImages({
					success: true,
					data: { files: pending.files, folder_id: folder.id },
				});
			} catch (error) {
				console.error("useOpenImages: Error creating folder:", error);
			}
		} else {
			await handleOpenImages({
				success: true,
				data: {
					files: pending.files,
					folder_id: currentFolderId ?? undefined,
				},
			});
		}
	},

	cancelFolderImport: () => {
		set({ pendingFolderImport: null });
	},
}));

export default openImagesStore;
