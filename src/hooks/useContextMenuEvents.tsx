import { useEffect } from "react";
import { MENU_EVENTS } from "../../shared/constants";
import { imagesStore } from "../stores/images";
import { playlistStore } from "../stores/playlist";
import {
	type DaemonDeleteImageFromGalleryPayload,
	type DaemonSetImagesPerPagePayload,
} from "../../shared/types/daemonEvents";
import { type rendererImage } from "../types/rendererTypes";

const goDaemon = window.API_RENDERER.goDaemon;

const useContextMenuEvents = () => {
	useEffect(() => {
		const handleAddSelectedImagesToPlaylist = () => {
			console.log("🟠 Context Menu: Add selected images to playlist");
			// Open the AddToPlaylistModal
			const modal = document.getElementById(
				"AddToPlaylistModal",
			) as HTMLDialogElement;
			if (modal) {
				modal.showModal();
			} else {
				console.error("AddToPlaylistModal not found");
			}
		};

		const handleRemoveSelectedImagesFromPlaylist = () => {
			console.log(
				"🟠 Context Menu: Remove selected images from current playlist",
			);
			const { selectedImages } = imagesStore.getState();
			const { removeImagesFromPlaylist, playlist } = playlistStore.getState();

			if (selectedImages.size === 0) {
				console.warn("No images selected to remove from playlist");
				return;
			}

			if (!playlist.name || playlist.images.length === 0) {
				console.warn("No active playlist to remove images from");
				return;
			}

			// Remove the selected images from the current playlist
			removeImagesFromPlaylist(selectedImages);

			// Save the updated playlist
			goDaemon
				.savePlaylist(playlist)
				.then(() => {
					console.log(
						`Removed ${selectedImages.size} images from playlist ${playlist.name}`,
					);
				})
				.catch((error: unknown) => {
					console.error(
						`Failed to update playlist after removing images:`,
						error,
					);
				});
		};

		const handleDeleteAllSelectedImages = () => {
			console.log("🟠 Context Menu: Delete all selected images");
			const { selectedImages, removeFromSelectedImages } =
				imagesStore.getState();

			// Get image IDs to delete
			const imageIds = Array.from(selectedImages);

			// Delete all selected images via Go daemon
			goDaemon
				.deleteImagesFromGallery(imageIds)
				.then(() => {
					// Remove from selected images
					imageIds.forEach((id) => {
						const image = imagesStore.getState().imagesMap.get(id);
						if (image) {
							removeFromSelectedImages(image);
						}
					});
					console.log(`Deleted ${imageIds.length} images`);
				})
				.catch((error: unknown) => {
					console.error(`Failed to delete images:`, error);
				});
		};

		const handleClearSelectionOnCurrentPage = () => {
			console.log("🟠 Context Menu: Clear selection on current page");
			const { clearSelectionOnCurrentPage } = imagesStore.getState();
			clearSelectionOnCurrentPage();
		};

		const handleClearSelection = () => {
			console.log("🟠 Context Menu: Clear all selection");
			const { clearSelection } = imagesStore.getState();
			clearSelection();
		};

		const handleSelectAllImagesInCurrentPage = () => {
			console.log("🟠 Context Menu: Select all images in current page");
			const { selectAllImagesInCurrentPage } = imagesStore.getState();
			selectAllImagesInCurrentPage();
		};

		const handleSelectAllImagesInGallery = () => {
			console.log("🟠 Context Menu: Select all images in gallery");
			const { selectAllImagesInGallery } = imagesStore.getState();
			selectAllImagesInGallery();
		};

		const handleSetImagesPerPage = (...args: unknown[]) => {
			const payload = args[0] as DaemonSetImagesPerPagePayload;
			console.log(
				"🟠 Context Menu: Set images per page to",
				payload.imagesPerPage,
			);

			// Update the app config via Go daemon
			goDaemon
				.setBulkConfig({
					app: {
						images_per_page: payload.imagesPerPage,
					},
				})
				.then(() => {
					console.log(`Updated images per page to ${payload.imagesPerPage}`);
					// Reload the page to reflect the changes
					window.location.reload();
				})
				.catch((error: unknown) => {
					console.error("Failed to update images per page:", error);
				});
		};

		const handleDeleteImageFromGallery = (...args: unknown[]) => {
			const image = args[0] as DaemonDeleteImageFromGalleryPayload;
			console.log("🟠 Context Menu: Delete image from gallery", image);
			const { removeFromSelectedImages } = imagesStore.getState();

			// Convert DaemonDeleteImageFromGalleryPayload to rendererImage for compatibility
			const imageToRemove: rendererImage = {
				id: image.id,
				name: image.name,
				path: image.path,
				mediaType: "image",
				dimensions: { width: 0, height: 0 },
				metadata: {
					format: "",
					fileSize: 0,
					checksum: "",
					tags: [],
					properties: {},
				},
				selection: {
					isChecked: false,
					isSelected: false,
					selectedAt: undefined,
					selectedPlaylists: [],
				},
				importInfo: {
					importedAt: "",
					sourcePath: image.path,
					importer: "unknown",
				},
				thumbnails: {
					"720p": "",
					"1080p": "",
					"1440p": "",
					"4k": "",
					fallback: "",
				},
				time: null,
			};

			goDaemon
				.deleteImagesFromGallery([image.id])
				.then(() => {
					removeFromSelectedImages(imageToRemove);
					console.log(`Deleted image: ${image.name}`);
				})
				.catch((error: unknown) => {
					console.error(`Failed to delete image ${image.name}:`, error);
				});
		};

		// Set up IPC event listeners
		const cleanup = () => {
			// Remove all event listeners
			goDaemon.off(
				MENU_EVENTS.addSelectedImagesToPlaylist,
				handleAddSelectedImagesToPlaylist,
			);
			goDaemon.off(
				MENU_EVENTS.removeSelectedImagesFromPlaylist,
				handleRemoveSelectedImagesFromPlaylist,
			);
			goDaemon.off(
				MENU_EVENTS.deleteAllSelectedImages,
				handleDeleteAllSelectedImages,
			);
			goDaemon.off(
				MENU_EVENTS.clearSelectionOnCurrentPage,
				handleClearSelectionOnCurrentPage,
			);
			goDaemon.off(MENU_EVENTS.clearSelection, handleClearSelection);
			goDaemon.off(
				MENU_EVENTS.selectAllImagesInCurrentPage,
				handleSelectAllImagesInCurrentPage,
			);
			goDaemon.off(
				MENU_EVENTS.selectAllImagesInGallery,
				handleSelectAllImagesInGallery,
			);
			goDaemon.off(MENU_EVENTS.setImagesPerPage, handleSetImagesPerPage);
			goDaemon.off(
				MENU_EVENTS.deleteImageFromGallery,
				handleDeleteImageFromGallery,
			);
		};

		// Add event listeners
		goDaemon.on(
			MENU_EVENTS.addSelectedImagesToPlaylist,
			handleAddSelectedImagesToPlaylist,
		);
		goDaemon.on(
			MENU_EVENTS.removeSelectedImagesFromPlaylist,
			handleRemoveSelectedImagesFromPlaylist,
		);
		goDaemon.on(
			MENU_EVENTS.deleteAllSelectedImages,
			handleDeleteAllSelectedImages,
		);
		goDaemon.on(
			MENU_EVENTS.clearSelectionOnCurrentPage,
			handleClearSelectionOnCurrentPage,
		);
		goDaemon.on(MENU_EVENTS.clearSelection, handleClearSelection);
		goDaemon.on(
			MENU_EVENTS.selectAllImagesInCurrentPage,
			handleSelectAllImagesInCurrentPage,
		);
		goDaemon.on(
			MENU_EVENTS.selectAllImagesInGallery,
			handleSelectAllImagesInGallery,
		);
		goDaemon.on(MENU_EVENTS.setImagesPerPage, handleSetImagesPerPage);
		goDaemon.on(
			MENU_EVENTS.deleteImageFromGallery,
			handleDeleteImageFromGallery,
		);

		return cleanup;
	}, []);
};

export default useContextMenuEvents;
