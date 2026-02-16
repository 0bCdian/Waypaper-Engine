import type {
	Image,
	Playlist,
	PlaylistConfiguration,
	PlaylistImage,
	MonitorMode,
	Pagination,
} from "../../electron/daemon-go-types";
import {
	type PLAYLIST_TYPES_TYPE,
	type PLAYLIST_ORDER_TYPES,
} from "../../shared/types/playlist";
import { type Formats } from "../../shared/types/image";

export enum STORE_ACTIONS {
	SET_IMAGES_ARRAY = "SET_IMAGES_ARRAY",
	SET_SKELETONS_TO_SHOW = "SET_SKELETONS_TO_SHOW",
	SET_FILTERS = "SET_FILTERS",
	RESET_IMAGES_ARRAY = "RESET_IMAGES_ARRAY",
}

// Renderer image extends the daemon Image with playlist-specific time
export interface rendererImage extends Image {
	time: number | null; // Minutes since midnight (0-1439) for time_of_day playlists
}

export interface rendererPlaylist {
	id?: number; // Undefined for new playlists, set for existing
	name: string;
	images: PlaylistImage[];
	configuration: PlaylistConfiguration;
}

export type monitorSelectType = MonitorMode;

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
	pagination: Pagination | null;
}
