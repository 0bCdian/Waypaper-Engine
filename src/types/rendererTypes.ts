import type {
	Image,
	PlaylistConfiguration,
	PlaylistImage,
	MonitorMode,
	Pagination,
} from "../../electron/daemon-go-types";
import type { Formats } from "../../shared/types/image";

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
	tags: string[];
	advancedFilters: advancedFilters;
}

export interface advancedFilters {
	formats: Formats[];
	resolution: {
		constraint: resolutionConstraints;
		width: number;
		height: number;
	};
	colors: string[];
}

export type resolutionConstraints = "all" | "exact" | "moreThan" | "lessThan";

export interface state {
	imagesArray: rendererImage[];
	filters: Filters;
	pagination: Pagination | null;
}
