import { type imagesObject } from "../../shared/types";
import { type Formats } from "../../shared/types/image";
import {
	type PLAYLIST_TYPES_TYPE,
	type PLAYLIST_ORDER_TYPES,
} from "../../shared/types/playlist";
import {
	type ActiveMonitor,
	type MonitorSelection,
} from "../../shared/types/monitor";
import { type JsonStoreImage } from "../../shared/types/daemon";

export enum STORE_ACTIONS {
	SET_IMAGES_ARRAY = "SET_IMAGES_ARRAY",
	SET_SKELETONS_TO_SHOW = "SET_SKELETONS_TO_SHOW",
	SET_FILTERS = "SET_FILTERS",
	RESET_IMAGES_ARRAY = "RESET_IMAGES_ARRAY",
}

// Updated configuration to match new daemon API
export interface configuration {
	type: PLAYLIST_TYPES_TYPE;
	interval: number | null; // Seconds for timer playlists
	order: PLAYLIST_ORDER_TYPES | null;
	showAnimations: boolean;
	alwaysStartOnFirstImage: boolean;
	currentImageIndex: number; // Added for v2.0.0 API
}

// Renderer image extends the shared JsonStoreImage type
export interface rendererImage extends JsonStoreImage {
	time: number | null; // Minutes since midnight (0-1439) for time_of_day playlists
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
	activeMonitor: ActiveMonitor | MonitorSelection; // Support both legacy and new API
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
