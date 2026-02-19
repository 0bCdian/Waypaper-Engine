import type { MenuItem } from "../stores/contextMenuStore";
import type { rendererImage } from "../types/rendererTypes";
import type { Monitor, PlaylistImage } from "../../electron/daemon-go-types";
import { useImagesStore } from "../stores/images";
import { usePlaylistStore } from "../stores/playlist";
import { useImageDetailStore } from "../stores/imageDetailStore";
import { confirmDialog } from "../components/ConfirmDialog";
import openImagesStore from "../hooks/useOpenImages";
import type { Image } from "../../electron/daemon-go-types";

const { goDaemon } = window.API_RENDERER;

function wallpaperSubmenu(
	imageId: number,
	monitors: Monitor[],
): MenuItem[] {
	const items: MenuItem[] = [
		{
			type: "action",
			label: "Duplicate across all monitors",
			onClick: () => {
				void goDaemon.setWallpaper(imageId, "*", "clone");
			},
		},
		{
			type: "action",
			label: "Extend across all monitors",
			onClick: () => {
				void goDaemon.setWallpaper(imageId, "*", "extend");
			},
		},
	];

	if (monitors.length > 0) {
		items.push({ type: "separator" });
		for (const monitor of monitors) {
			items.push({
				type: "action",
				label: `On ${monitor.name}`,
				onClick: () => {
					void goDaemon.setWallpaper(imageId, monitor.name, "individual");
				},
			});
		}
	}

	return items;
}

function selectionItems(selectedCount: number): MenuItem[] {
	if (selectedCount === 0) return [];

	const items: MenuItem[] = [
		{
			type: "action",
			label: "Add selected to playlist",
			onClick: () => {
				const modal = document.getElementById(
					"AddToPlaylistModal",
				) as HTMLDialogElement | null;
				modal?.showModal();
			},
		},
		{
			type: "action",
			label: "Remove selected from playlist",
			onClick: () => {
				const { selectedImages } = useImagesStore.getState();
				const { removeImagesFromPlaylist, playlist } =
					usePlaylistStore.getState();
				if (selectedImages.size === 0 || playlist.images.length === 0) return;
				removeImagesFromPlaylist(selectedImages);
				if (playlist.id) {
					void goDaemon.updatePlaylist(playlist.id, {
						images: playlist.images.map((img) => ({
							image_id: img.image_id,
							time: img.time,
						})),
					});
				}
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
				const { selectedImages, clearSelection } =
					useImagesStore.getState();
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
			onClick: () =>
				useImagesStore.getState().selectAllImagesInCurrentPage(),
		},
		{
			type: "action",
			label: "Select all in gallery",
			onClick: () =>
				useImagesStore.getState().selectAllImagesInGallery(),
		},
		{
			type: "submenu",
			label: "Images per page",
			children: [20, 50, 100, 200].map((count) => ({
				type: "action" as const,
				label: String(count),
				onClick: () => {
					void goDaemon
						.updateConfigSection("app", { images_per_page: count })
						.then(() => {
							useImagesStore.setState({ perPage: count });
							useImagesStore.getState().fetchPage(1);
						});
				},
			})),
		},
	];

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
	const items: MenuItem[] = [
		{
			type: "submenu",
			label: `Set "${image.name}"`,
			children: wallpaperSubmenu(image.id, monitors),
		},
		{
			type: "action",
			label: "Edit details",
			onClick: () => {
				useImageDetailStore
					.getState()
					.open(image as unknown as Image);
			},
		},
		{
			type: "action",
			label: "Copy image path",
			onClick: () => {
				void navigator.clipboard.writeText(image.path);
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
			label: "Add to playlist",
			onClick: () => {
				usePlaylistStore.getState().addImagesToPlaylist([image.id]);
			},
		},
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
			children: wallpaperSubmenu(imageId, monitors),
		},
		{
			type: "action",
			label: "Move to top",
			onClick: () => {
				const { playlist, movePlaylistArrayOrder } =
					usePlaylistStore.getState();
				const idx = playlist.images.findIndex(
					(img) => img.image_id === playlistImage.image_id,
				);
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
				const { playlist, movePlaylistArrayOrder } =
					usePlaylistStore.getState();
				const idx = playlist.images.findIndex(
					(img) => img.image_id === playlistImage.image_id,
				);
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
				usePlaylistStore
					.getState()
					.removeImagesFromPlaylist(
						new Set([playlistImage.image_id]),
					);
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
		{ type: "separator" },
		...globalItems(selectedCount),
	];

	return items;
}
