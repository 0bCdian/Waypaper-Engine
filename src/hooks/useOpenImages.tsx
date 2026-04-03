import { create } from "zustand";
import type { openFileAction } from "../../shared/types";
import { useFoldersStore } from "../stores/foldersStore";
import { logger } from "../utils/logger";

const { openFiles, handleOpenImages, scanDirectory, goDaemon } = window.API_RENDERER;

interface PendingFolderImport {
  files: string[];
  webRoots: string[];
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
  importDroppedDirectory: (dirPath: string) => Promise<void>;
  confirmFolderImport: (createFolder: boolean) => Promise<void>;
  cancelFolderImport: () => void;
}

async function importWebPackageRoots(roots: string[], folderID: number | undefined) {
  for (const root of roots) {
    try {
      await goDaemon.importWebWallpaper(root, folderID);
    } catch (error) {
      logger.error("useOpenImages: import web wallpaper failed:", root, error);
    }
  }
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

    const data = result.data;
    const files = data?.files ?? result.files ?? [];
    const webRoots = data?.webRoots ?? [];
    const pickedFolderName = data?.folderName ?? result.folderName;

    if (action === "web") {
      const targetPath = files[0];
      if (!targetPath) return;
      const currentFolderId = useFoldersStore.getState().currentFolderId;
      try {
        await goDaemon.importWebWallpaper(targetPath, currentFolderId ?? undefined);
      } catch (error) {
        logger.error("useOpenImages: Error importing web wallpaper:", error);
      }
      return;
    }

    if (action === "folder" && pickedFolderName && (files.length > 0 || webRoots.length > 0)) {
      set({
        pendingFolderImport: {
          files,
          webRoots,
          folderName: pickedFolderName,
        },
      });
      return;
    }

    if (files.length === 0) {
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
      logger.error("useOpenImages: Error calling handleOpenImages:", error);
    }
  },

  importDroppedDirectory: async (dirPath: string) => {
    let result: { files: string[]; webRoots: string[]; folderName: string };
    try {
      result = await scanDirectory(dirPath);
    } catch (error) {
      logger.error("useOpenImages: scanDirectory failed for", dirPath, error);
      return;
    }
    const webRoots = result.webRoots ?? [];
    if (result.files.length === 0 && webRoots.length === 0) {
      try {
        await goDaemon.importWebWallpaper(dirPath, useFoldersStore.getState().currentFolderId ?? undefined);
        return;
      } catch {
        logger.warn("useOpenImages: no media found in directory", dirPath);
        return;
      }
    }
    set({
      pendingFolderImport: {
        files: result.files,
        webRoots,
        folderName: result.folderName,
      },
    });
  },

  confirmFolderImport: async (createFolder: boolean) => {
    const pending = get().pendingFolderImport;
    if (!pending) return;

    set({ pendingFolderImport: null });
    const currentFolderId = useFoldersStore.getState().currentFolderId;
    const { files, webRoots, folderName } = pending;

    let targetFolderId: number | undefined;
    if (createFolder) {
      try {
        const folder = await useFoldersStore.getState().createFolder(folderName, currentFolderId);
        targetFolderId = folder.id;
      } catch (error) {
        logger.error("useOpenImages: Error creating folder:", error);
        return;
      }
    } else {
      targetFolderId = currentFolderId ?? undefined;
    }

    if (files.length > 0) {
      try {
        await handleOpenImages({
          success: true,
          data: { files, folder_id: targetFolderId },
        });
      } catch (error) {
        logger.error("useOpenImages: Error calling handleOpenImages:", error);
      }
    }

    if (webRoots.length > 0) {
      await importWebPackageRoots(webRoots, targetFolderId);
    }
  },

  cancelFolderImport: () => {
    set({ pendingFolderImport: null });
  },
}));

export default openImagesStore;
