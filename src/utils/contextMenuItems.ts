import type { MenuItem } from "../stores/contextMenuStore";
import type { rendererImage } from "../types/rendererTypes";
import type { Monitor, PlaylistImage, Folder } from "../../electron/daemon-go-types";
import { useImagesStore } from "../stores/images";
import { usePlaylistStore } from "../stores/playlist";
import { useImageDetailStore } from "../stores/imageDetailStore";
import { useHistoryStore } from "../stores/historyStore";
import { useFoldersStore, getAllImageIdsInFolder } from "../stores/foldersStore";
import { useFolderPickerStore } from "../stores/folderPickerStore";
import { confirmDialog } from "../components/ConfirmDialog";
import openImagesStore from "../hooks/useOpenImages";
import type { Image } from "../../electron/daemon-go-types";
import { notifyWallpaperApplyFailed } from "./daemonUserFacingError";
import { buildWallpaperSubmenu, buildClearHistoryItem } from "./sharedContextMenuHelpers";
import { useToastStore } from "../stores/toastStore";

const { goDaemon } = window.API_RENDERER;

async function exportWallpapersFromRenderer(images: rendererImage[]) {
  if (images.length === 0) return;
  const addToast = useToastStore.getState().addToast;
  try {
    const res = await window.API_RENDERER.exportWallpapersToFolder(
      images.map((img) => ({
        id: img.id,
        name: img.name,
        path: img.path,
        media_type: img.media_type,
        package_root: img.web_meta?.package_root ?? null,
      })),
    );
    if (res.canceled) return;
    if (res.exported === 0 && res.failed > 0) {
      addToast("Export failed for all items", "error", 4000);
      return;
    }
    const msg =
      res.failed > 0
        ? `Exported ${res.exported} of ${images.length} (${res.failed} failed)`
        : `Exported ${res.exported} wallpaper(s) to ${res.destination}`;
    addToast(msg, res.failed > 0 ? "warning" : "success", 5000);
  } catch (e) {
    addToast(e instanceof Error ? e.message : "Export failed", "error");
  }
}

function getParentFolderId(): number | null | undefined {
  const { currentFolderId, breadcrumbPath } = useFoldersStore.getState();
  if (currentFolderId === null) return undefined;
  if (breadcrumbPath.length <= 1) return null;
  return breadcrumbPath[breadcrumbPath.length - 2].id;
}

function toFilesystemPath(path: string): string {
  if (path?.startsWith("atom://")) return `/${path.slice("atom://".length)}`;
  return path;
}

function selectionItems(selectedCount: number): MenuItem[] {
  if (selectedCount === 0) return [];

  const items: MenuItem[] = [
    {
      type: "action",
      label: "Move selected to folder…",
      onClick: () => {
        const { selectedImages } = useImagesStore.getState();
        if (selectedImages.size === 0) return;
        useFolderPickerStore.getState().open(Array.from(selectedImages));
      },
    },
    {
      type: "action",
      label: "Export selected to folder…",
      onClick: () => {
        const selected = useImagesStore.getState().getSelectedImages();
        void exportWallpapersFromRenderer(selected);
      },
    },
    ...(useFoldersStore.getState().currentFolderId !== null
      ? [
          {
            type: "action" as const,
            label: "Move selected to parent folder",
            onClick: async () => {
              const parentId = getParentFolderId();
              if (parentId === undefined) return;
              const { selectedImages, clearSelection } = useImagesStore.getState();
              if (selectedImages.size === 0) return;
              await useFoldersStore
                .getState()
                .moveImagesToFolder(Array.from(selectedImages), parentId);
              clearSelection();
              useImagesStore.getState().reQueryImages();
            },
          },
        ]
      : []),
    {
      type: "action",
      label: "Add selected to playlist",
      onClick: () => {
        const { selectedImages } = useImagesStore.getState();
        if (selectedImages.size === 0) return;
        usePlaylistStore.getState().addImagesToPlaylist(Array.from(selectedImages));
      },
    },
    {
      type: "action",
      label: "Save selected to saved playlist…",
      onClick: () => {
        const modal = document.getElementById("AddToPlaylistModal") as HTMLDialogElement | null;
        modal?.showModal();
      },
    },
    {
      type: "action",
      label: "Remove selected from playlist",
      onClick: () => {
        const { selectedImages } = useImagesStore.getState();
        const { removeImagesFromPlaylist, playlist } = usePlaylistStore.getState();
        if (selectedImages.size === 0 || playlist.images.length === 0) return;
        removeImagesFromPlaylist(selectedImages);
      },
    },
    {
      type: "action",
      label: `Delete ${selectedCount} selected images`,
      danger: true,
      onClick: async () => {
        const confirmed = await confirmDialog({
          title: "Delete images",
          message: `Are you sure you want to delete ${selectedCount} images? This cannot be undone.`,
          confirmLabel: "Delete",
          danger: true,
        });
        if (!confirmed) return;
        const { selectedImages, clearSelection } = useImagesStore.getState();
        const ids = Array.from(selectedImages);
        void goDaemon.deleteImages(ids).then(() => clearSelection());
      },
    },
    { type: "separator" },
    {
      type: "action",
      label: "Unselect images in current page",
      onClick: () => useImagesStore.getState().clearSelectionOnCurrentPage(),
    },
    {
      type: "action",
      label: "Unselect all images",
      onClick: () => useImagesStore.getState().clearSelection(),
    },
  ];

  return items;
}

function globalItems(selectedCount: number): MenuItem[] {
  const items: MenuItem[] = [
    {
      type: "action",
      label: "Select all in current page",
      onClick: () => useImagesStore.getState().selectAllImagesInCurrentPage(),
    },
    {
      type: "action",
      label: "Select all in gallery",
      onClick: () => useImagesStore.getState().selectAllImagesInGallery(),
    },
    {
      type: "submenu",
      label: "Images per page",
      children: [10, 20, 30, 50, 75, 100, 150, 200].map((count) => ({
        type: "action" as const,
        label: String(count),
        onClick: () => {
          void goDaemon.updateConfigSection("app", { images_per_page: count }).then(() => {
            useImagesStore.setState({ perPage: count });
            useImagesStore.getState().fetchPage(1);
          });
        },
      })),
    },
  ];

  items.push({ type: "separator" });
  items.push(buildClearHistoryItem(() => void useHistoryStore.getState().clearHistory()));

  if (selectedCount > 0) {
    items.unshift(...selectionItems(selectedCount), { type: "separator" });
  }

  return items;
}

export function buildImageMenuItems(
  image: rendererImage,
  monitors: Monitor[],
  selectedCount: number,
): MenuItem[] {
  const mediaType = (image.media_type || "image").toLowerCase();
  const allowExtend = mediaType === "image" || mediaType === "gif";
  const items: MenuItem[] = [
    {
      type: "submenu",
      label: `Set "${image.name}"`,
      children: buildWallpaperSubmenu(
        monitors,
        (monitor, mode) => {
          void goDaemon.setWallpaper(image.id, monitor, mode).catch(notifyWallpaperApplyFailed);
        },
        undefined,
        { allowExtend },
      ),
    },
    {
      type: "action",
      label: "Edit details",
      onClick: () => {
        useImageDetailStore.getState().open(image as unknown as Image);
      },
    },
    {
      type: "action",
      label: "Copy image path",
      onClick: () => {
        void navigator.clipboard.writeText(toFilesystemPath(image.path));
      },
    },
    {
      type: "action",
      label: "Open in file manager",
      onClick: () => {
        void window.API_RENDERER.revealInFileManager(image.path);
      },
    },
    {
      type: "action",
      label: "Export to folder…",
      onClick: () => {
        void exportWallpapersFromRenderer([image]);
      },
    },
    {
      type: "action",
      label: "Add to playlist",
      onClick: () => {
        usePlaylistStore.getState().addImagesToPlaylist([image.id]);
      },
    },
    {
      type: "action",
      label: "Move to folder…",
      onClick: () => {
        useFolderPickerStore.getState().open([image.id]);
      },
    },
    ...(useFoldersStore.getState().currentFolderId !== null
      ? [
          {
            type: "action" as const,
            label: "Move to parent folder",
            onClick: async () => {
              const parentId = getParentFolderId();
              if (parentId === undefined) return;
              await useFoldersStore.getState().moveImagesToFolder([image.id], parentId);
              useImagesStore.getState().reQueryImages();
            },
          },
        ]
      : []),
    { type: "separator" },
    {
      type: "action",
      label: `Delete "${image.name}"`,
      danger: true,
      onClick: async () => {
        const confirmed = await confirmDialog({
          title: "Delete image",
          message: `Are you sure you want to delete "${image.name}"? This cannot be undone.`,
          confirmLabel: "Delete",
          danger: true,
        });
        if (confirmed) {
          void goDaemon.deleteImages([image.id]);
        }
      },
    },
    { type: "separator" },
    ...globalItems(selectedCount),
  ];

  return items;
}

export function buildPlaylistCardMenuItems(
  playlistImage: PlaylistImage,
  imageName: string,
  imageId: number,
  monitors: Monitor[],
): MenuItem[] {
  const items: MenuItem[] = [
    {
      type: "submenu",
      label: `Set "${imageName}"`,
      children: buildWallpaperSubmenu(monitors, (monitor, mode) => {
        void goDaemon.setWallpaper(imageId, monitor, mode).catch(notifyWallpaperApplyFailed);
      }),
    },
    {
      type: "action",
      label: "Move to top",
      onClick: () => {
        const { playlist, movePlaylistArrayOrder } = usePlaylistStore.getState();
        const idx = playlist.images.findIndex((img) => img.image_id === playlistImage.image_id);
        if (idx <= 0) return;
        const newArr = [...playlist.images];
        const [item] = newArr.splice(idx, 1);
        newArr.unshift(item);
        movePlaylistArrayOrder(newArr);
      },
    },
    {
      type: "action",
      label: "Move to bottom",
      onClick: () => {
        const { playlist, movePlaylistArrayOrder } = usePlaylistStore.getState();
        const idx = playlist.images.findIndex((img) => img.image_id === playlistImage.image_id);
        if (idx < 0 || idx === playlist.images.length - 1) return;
        const newArr = [...playlist.images];
        const [item] = newArr.splice(idx, 1);
        newArr.push(item);
        movePlaylistArrayOrder(newArr);
      },
    },
    { type: "separator" },
    {
      type: "action",
      label: "Remove from playlist",
      danger: true,
      onClick: () => {
        usePlaylistStore.getState().removeImagesFromPlaylist(new Set([playlistImage.image_id]));
      },
    },
  ];

  return items;
}

export function buildGalleryMenuItems(selectedCount: number): MenuItem[] {
  const items: MenuItem[] = [
    {
      type: "action",
      label: "Import images",
      onClick: () => {
        void openImagesStore.getState().openImages({ action: "file" });
      },
    },
    {
      type: "action",
      label: "Import folder",
      onClick: () => {
        void openImagesStore.getState().openImages({ action: "folder" });
      },
    },
    {
      type: "action",
      label: "Import videos",
      onClick: () => {
        void openImagesStore.getState().openImages({ action: "video" });
      },
    },
    {
      type: "action",
      label: "Import web wallpaper",
      onClick: () => {
        void openImagesStore.getState().openImages({ action: "web" });
      },
    },
    { type: "separator" },
    {
      type: "action",
      label: "New folder",
      onClick: async () => {
        const currentFolderId = useFoldersStore.getState().currentFolderId;
        try {
          await useFoldersStore.getState().createFolder("New folder", currentFolderId);
        } catch {
          // silently fail
        }
      },
    },
    { type: "separator" },
    ...globalItems(selectedCount),
  ];

  return items;
}

export function buildFolderMenuItems(folder: Folder, onRename: () => void): MenuItem[] {
  const items: MenuItem[] = [
    {
      type: "action",
      label: "Open folder",
      onClick: () => {
        useFoldersStore.getState().navigateToFolder(folder.id);
        useImagesStore.getState().fetchPage(1, { folder_id: folder.id });
      },
    },
    {
      type: "action",
      label: "Rename folder",
      onClick: onRename,
    },
    { type: "separator" },
    {
      type: "action",
      label: "Add folder images to playlist",
      onClick: async () => {
        const ids = await getAllImageIdsInFolder(folder.id);
        if (ids.length > 0) usePlaylistStore.getState().addImagesToPlaylist(ids);
      },
    },
    {
      type: "action",
      label: "Remove folder images from playlist",
      onClick: async () => {
        const ids = await getAllImageIdsInFolder(folder.id);
        if (ids.length > 0) usePlaylistStore.getState().removeImagesFromPlaylist(new Set(ids));
      },
    },
    { type: "separator" },
    {
      type: "action",
      label: "Delete folder (keep contents)",
      danger: true,
      onClick: async () => {
        const confirmed = await confirmDialog({
          title: "Delete folder",
          message: `Delete "${folder.name}"? Images will be moved to the parent level.`,
          confirmLabel: "Delete folder",
          danger: true,
        });
        if (!confirmed) return;
        await useFoldersStore.getState().deleteFolder(folder.id, "keep_contents");
        const fid = useFoldersStore.getState().currentFolderId;
        useImagesStore.getState().fetchPage(1, {
          folder_id: fid === null ? "root" : fid,
        });
      },
    },
    {
      type: "action",
      label: "Delete folder and contents",
      danger: true,
      onClick: async () => {
        const confirmed = await confirmDialog({
          title: "Delete folder and all contents",
          message: `Delete "${folder.name}" and ALL images inside it? This cannot be undone.`,
          confirmLabel: "Delete everything",
          danger: true,
        });
        if (!confirmed) return;
        await useFoldersStore.getState().deleteFolder(folder.id, "delete_all");
        const fid = useFoldersStore.getState().currentFolderId;
        useImagesStore.getState().fetchPage(1, {
          folder_id: fid === null ? "root" : fid,
        });
      },
    },
  ];

  return items;
}
