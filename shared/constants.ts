import { type appConfigType } from "./types/app";
import { type Formats } from "./types/image";
import { type objectValues } from "./types";

export const validImageExtensions: Formats[] = [
	"jpeg",
	"jpg",
	"png",
	"gif",
	"bmp",
	"webp",
	"pnm",
	"tga",
	"tiff",
	"farbfeld",
];

export const initialAppConfig: appConfigType = {
	kill_daemon_on_exit: false,
	notifications: true,
	start_minimized: false,
	minimize_instead_of_close: false,
	show_monitor_modal_on_start: false,
	images_per_page: 50,
	theme: "dark",
	image_history_limit: 100,
	sort_by: "imported_at",
	sort_order: "desc",
};

export const SHORTCUT_EVENTS = {
	selectAllImagesInCurrentPage: "selectAllImagesInCurrentPage",
	clearSelection: "clearSelection",
	selectAllImagesInGallery: "selectAllImagesInGallery",
} as const;

export type SHORTCUT_EVENTS_TYPE = objectValues<typeof SHORTCUT_EVENTS>;
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

export type IPC_MAIN_EVENTS_TYPE = objectValues<typeof IPC_MAIN_EVENTS>;
