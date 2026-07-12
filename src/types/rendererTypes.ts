import type {
  Image,
  PlaylistConfiguration,
  PlaylistImage,
  MonitorMode,
} from "../../electron/daemon-go-types";

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
  type: "name" | "id" | "hue";
  mediaType: "all" | "image" | "video" | "web" | "gif";
  /** Token query: tag:, type:, ext:, color:, near:#hex~ΔE, q:, or plain text */
  filterTokens: string[];
  advancedFilters: advancedFilters;
  /** Seed image id for palette similarity filter (CIE76); null = off. */
  paletteSimilarToId: number | null;
  /** Inclusive max ΔE for palette similarity (sent as palette_max_delta_e). */
  paletteSimilarMaxDeltaE: number;
  /** Hue group filter for the swatch strip: 0-11 or 99 (neutral); null = off. */
  hueGroup: number | null;
}

export interface advancedFilters {
  resolution: {
    constraint: resolutionConstraints;
    width: number;
    height: number;
  };
}

export type resolutionConstraints = "all" | "exact" | "moreThan" | "lessThan";
