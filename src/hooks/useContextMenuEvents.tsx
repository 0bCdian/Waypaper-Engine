import { useEffect } from "react";
import { MENU_EVENTS } from "../../shared/constants";
import { imagesStore } from "../stores/images";
import { playlistsStore } from "../stores/playlists";

const { goDaemon } = window.API_RENDERER;

const useContextMenuEvents = () => {
    useEffect(() => {
        const handleAddSelectedImagesToPlaylist = () => {
            console.log("🟠 Context Menu: Add selected images to playlist");
            // TODO: Implement add selected images to playlist functionality
            // This should open a modal to select which playlist to add to
        };

        const handleRemoveSelectedImagesFromPlaylist = () => {
            console.log("🟠 Context Menu: Remove selected images from current playlist");
            // TODO: Implement remove selected images from playlist functionality
        };

        const handleDeleteAllSelectedImages = () => {
            console.log("🟠 Context Menu: Delete all selected images");
            const { selectedImages, removeFromSelectedImages } = imagesStore.getState();
            
            // Get image IDs to delete
            const imageIds = Array.from(selectedImages);
            
            // Delete all selected images via Go daemon
            goDaemon.deleteImagesFromGallery(imageIds).then(() => {
                // Remove from selected images
                imageIds.forEach(id => {
                    const image = imagesStore.getState().imagesMap.get(id);
                    if (image) {
                        removeFromSelectedImages(image);
                    }
                });
                console.log(`Deleted ${imageIds.length} images`);
            }).catch(error => {
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

        const handleSetImagesPerPage = (_event: any, count: number) => {
            console.log("🟠 Context Menu: Set images per page to", count);
            // TODO: Implement set images per page functionality
            // This should update the app config
        };

        const handleDeleteImageFromGallery = (_event: any, image: any) => {
            console.log("🟠 Context Menu: Delete image from gallery", image);
            const { removeFromSelectedImages } = imagesStore.getState();
            
            goDaemon.deleteImagesFromGallery([image.id]).then(() => {
                removeFromSelectedImages(image);
                console.log(`Deleted image: ${image.name}`);
            }).catch(error => {
                console.error(`Failed to delete image ${image.name}:`, error);
            });
        };

        // Set up IPC event listeners
        const cleanup = () => {
            // Remove all event listeners
            window.electronAPI?.ipcRenderer?.removeAllListeners(MENU_EVENTS.addSelectedImagesToPlaylist);
            window.electronAPI?.ipcRenderer?.removeAllListeners(MENU_EVENTS.removeSelectedImagesFromPlaylist);
            window.electronAPI?.ipcRenderer?.removeAllListeners(MENU_EVENTS.deleteAllSelectedImages);
            window.electronAPI?.ipcRenderer?.removeAllListeners(MENU_EVENTS.clearSelectionOnCurrentPage);
            window.electronAPI?.ipcRenderer?.removeAllListeners(MENU_EVENTS.clearSelection);
            window.electronAPI?.ipcRenderer?.removeAllListeners(MENU_EVENTS.selectAllImagesInCurrentPage);
            window.electronAPI?.ipcRenderer?.removeAllListeners(MENU_EVENTS.selectAllImagesInGallery);
            window.electronAPI?.ipcRenderer?.removeAllListeners(MENU_EVENTS.setImagesPerPage);
            window.electronAPI?.ipcRenderer?.removeAllListeners(MENU_EVENTS.deleteImageFromGallery);
        };

        // Add event listeners
        window.electronAPI?.ipcRenderer?.on(MENU_EVENTS.addSelectedImagesToPlaylist, handleAddSelectedImagesToPlaylist);
        window.electronAPI?.ipcRenderer?.on(MENU_EVENTS.removeSelectedImagesFromPlaylist, handleRemoveSelectedImagesFromPlaylist);
        window.electronAPI?.ipcRenderer?.on(MENU_EVENTS.deleteAllSelectedImages, handleDeleteAllSelectedImages);
        window.electronAPI?.ipcRenderer?.on(MENU_EVENTS.clearSelectionOnCurrentPage, handleClearSelectionOnCurrentPage);
        window.electronAPI?.ipcRenderer?.on(MENU_EVENTS.clearSelection, handleClearSelection);
        window.electronAPI?.ipcRenderer?.on(MENU_EVENTS.selectAllImagesInCurrentPage, handleSelectAllImagesInCurrentPage);
        window.electronAPI?.ipcRenderer?.on(MENU_EVENTS.selectAllImagesInGallery, handleSelectAllImagesInGallery);
        window.electronAPI?.ipcRenderer?.on(MENU_EVENTS.setImagesPerPage, handleSetImagesPerPage);
        window.electronAPI?.ipcRenderer?.on(MENU_EVENTS.deleteImageFromGallery, handleDeleteImageFromGallery);

        return cleanup;
    }, []);
};

export default useContextMenuEvents;
