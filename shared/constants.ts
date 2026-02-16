import type { objectValues } from "./types";

export const MENU_EVENTS = {
	selectAllImagesInGallery: "selectAllImagesInGallery",
	selectAllImagesInCurrentPage: "selectAllImagesInCurrentPage",
	clearSelectionOnCurrentPage: "clearSelectionOnCurrentPage",
	clearSelection: "clearSelection",
	setImagesPerPage: "setImagesPerPage",
	addSelectedImagesToPlaylist: "addSelectedImagesToPlaylist",
	deleteAllSelectedImages: "deleteAllSelectedImages",
	removeSelectedImagesFromPlaylist: "removeSelectedImagesFromPlaylist",
	deleteImageFromGallery: "deleteImageFromGallery",
} as const;

export type IPC_RENDERER_EVENTS_TYPE = objectValues<typeof MENU_EVENTS>;

export const IPC_MAIN_EVENTS = {
	updateAppConfig: "updateAppConfig",
	displaysChanged: "displaysChanged",
	clearPlaylist: "clearPlaylist",
	requeryPlaylist: "requeryPlaylist",
} as const;
