import { useEffect } from "react";
import { MENU_EVENTS } from "../../shared/constants";
import { imagesStore } from "../stores/images";
import { playlistStore } from "../stores/playlist";

const { goDaemon, onMenuEvent, offMenuEvent } = window.API_RENDERER;

const useContextMenuEvents = () => {
	useEffect(() => {
		const handleAddSelectedImagesToPlaylist = () => {
			const modal = document.getElementById(
				"AddToPlaylistModal",
			) as HTMLDialogElement;
			if (modal) {
				modal.showModal();
			}
		};

		const handleRemoveSelectedImagesFromPlaylist = () => {
			const { selectedImages } = imagesStore.getState();
			const { removeImagesFromPlaylist, playlist } = playlistStore.getState();

			if (selectedImages.size === 0 || !playlist.name || playlist.images.length === 0) {
				return;
			}

			removeImagesFromPlaylist(selectedImages);

			if (playlist.id) {
				goDaemon
					.updatePlaylist(playlist.id, {
						images: playlist.images.map((img) => ({
							image_id: img.image_id,
							time: img.time,
						})),
					})
					.catch((error: unknown) => {
						console.error("Failed to update playlist after removing images:", error);
					});
			}
		};

		const handleDeleteAllSelectedImages = () => {
			const { selectedImages, clearSelection } = imagesStore.getState();
			const imageIds = Array.from(selectedImages);

			goDaemon
				.deleteImages(imageIds)
				.then(() => {
					clearSelection();
				})
				.catch((error: unknown) => {
					console.error("Failed to delete images:", error);
				});
		};

		const handleClearSelectionOnCurrentPage = () => {
			const { clearSelectionOnCurrentPage } = imagesStore.getState();
			clearSelectionOnCurrentPage();
		};

		const handleClearSelection = () => {
			const { clearSelection } = imagesStore.getState();
			clearSelection();
		};

		const handleSelectAllImagesInCurrentPage = () => {
			const { selectAllImagesInCurrentPage } = imagesStore.getState();
			selectAllImagesInCurrentPage();
		};

		const handleSelectAllImagesInGallery = () => {
			const { selectAllImagesInGallery } = imagesStore.getState();
			selectAllImagesInGallery();
		};

		const handleSetImagesPerPage = (...args: unknown[]) => {
			const imagesPerPage = args[0] as number;

			goDaemon
				.updateConfigSection("app", { images_per_page: imagesPerPage })
				.then(() => {
					imagesStore.setState({ perPage: imagesPerPage });
					imagesStore.getState().fetchPage(1);
				})
				.catch((error: unknown) => {
					console.error("Failed to update images per page:", error);
				});
		};

		// Register IPC event listeners
		onMenuEvent(MENU_EVENTS.addSelectedImagesToPlaylist, handleAddSelectedImagesToPlaylist);
		onMenuEvent(MENU_EVENTS.removeSelectedImagesFromPlaylist, handleRemoveSelectedImagesFromPlaylist);
		onMenuEvent(MENU_EVENTS.deleteAllSelectedImages, handleDeleteAllSelectedImages);
		onMenuEvent(MENU_EVENTS.clearSelectionOnCurrentPage, handleClearSelectionOnCurrentPage);
		onMenuEvent(MENU_EVENTS.clearSelection, handleClearSelection);
		onMenuEvent(MENU_EVENTS.selectAllImagesInCurrentPage, handleSelectAllImagesInCurrentPage);
		onMenuEvent(MENU_EVENTS.selectAllImagesInGallery, handleSelectAllImagesInGallery);
		onMenuEvent(MENU_EVENTS.setImagesPerPage, handleSetImagesPerPage);

		return () => {
			offMenuEvent(MENU_EVENTS.addSelectedImagesToPlaylist, handleAddSelectedImagesToPlaylist);
			offMenuEvent(MENU_EVENTS.removeSelectedImagesFromPlaylist, handleRemoveSelectedImagesFromPlaylist);
			offMenuEvent(MENU_EVENTS.deleteAllSelectedImages, handleDeleteAllSelectedImages);
			offMenuEvent(MENU_EVENTS.clearSelectionOnCurrentPage, handleClearSelectionOnCurrentPage);
			offMenuEvent(MENU_EVENTS.clearSelection, handleClearSelection);
			offMenuEvent(MENU_EVENTS.selectAllImagesInCurrentPage, handleSelectAllImagesInCurrentPage);
			offMenuEvent(MENU_EVENTS.selectAllImagesInGallery, handleSelectAllImagesInGallery);
			offMenuEvent(MENU_EVENTS.setImagesPerPage, handleSetImagesPerPage);
		};
	}, []);
};

export default useContextMenuEvents;
