import { type imagesObject } from "../../shared/types";
import { type Formats } from "../../shared/types/image";
import {
	type PLAYLIST_TYPES_TYPE,
	type PLAYLIST_ORDER_TYPES,
} from "../../shared/types/playlist";
// Database types no longer needed - using Go daemon
import { type ActiveMonitor } from "../../shared/types/monitor";
import { type JsonStoreImage } from "../../shared/types/daemon";

export enum STORE_ACTIONS {
	SET_IMAGES_ARRAY = "SET_IMAGES_ARRAY",
	SET_SKELETONS_TO_SHOW = "SET_SKELETONS_TO_SHOW",
	SET_FILTERS = "SET_FILTERS",
	RESET_IMAGES_ARRAY = "RESET_IMAGES_ARRAY",
}

export interface configuration {
	type: PLAYLIST_TYPES_TYPE;
	interval: number | null;
	order: PLAYLIST_ORDER_TYPES | null;
	showAnimations: boolean;
	alwaysStartOnFirstImage: boolean;
}

// Renderer image extends the shared JsonStoreImage type
export interface rendererImage extends JsonStoreImage {
	time: number | null;
}

export interface ImageThumbnails {
	"720p": string;
	"1080p": string;
	"1440p": string;
	"4k": string;
	fallback: string;
}
export interface rendererPlaylist {
	images: rendererImage[];
	configuration: configuration;
	name: string;
	activeMonitor: ActiveMonitor;
}
export type monitorSelectType = "individual" | "clone" | "extend";
export interface Filters {
	order: "asc" | "desc";
	type: "name" | "id";
	searchString: string;
	advancedFilters: advancedFilters;
}

export interface advancedFilters {
	formats: Formats[];
	resolution: {
		constraint: resolutionConstraints;
		width: number;
		height: number;
	};
}

export type resolutionConstraints = "all" | "exact" | "moreThan" | "lessThan";
export interface state {
	imagesArray: rendererImage[];
	filters: Filters;
}

export type action =
	| { type: STORE_ACTIONS.SET_IMAGES_ARRAY; payload: rendererImage[] }
	| {
			type: STORE_ACTIONS.SET_SKELETONS_TO_SHOW;
			payload: imagesObject | undefined;
	  }
	| { type: STORE_ACTIONS.SET_FILTERS; payload: Filters }
	| { type: STORE_ACTIONS.RESET_IMAGES_ARRAY; payload: rendererImage[] };
