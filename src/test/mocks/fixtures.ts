import type {
  Image,
  Playlist,
  Folder,
  Monitor,
  ImageHistoryEntry,
} from "../../../electron/daemon-go-types";
import type { rendererImage } from "../../types/rendererTypes";

export function sampleImage(id: number, overrides?: Partial<Image>): Image {
  return {
    id,
    name: `image_${id}.jpg`,
    path: `/tmp/images/image_${id}.jpg`,
    media_type: "image",
    duration: 0,
    audio_enabled: false,
    width: 1920,
    height: 1080,
    format: "jpg",
    file_size: 1024000,
    checksum: `sha256:abc${id}`,
    tags: ["nature", "landscape"],
    colors: ["#ff0000", "#00ff00"],
    imported_at: new Date().toISOString(),
    source_path: `/home/user/wallpapers/image_${id}.jpg`,
    is_selected: false,
    thumbnails: {
      default: `/tmp/thumbs/${id}_default.jpg`,
      "720p": `/tmp/thumbs/${id}_720p.jpg`,
      "1080p": `/tmp/thumbs/${id}_1080p.jpg`,
      "1440p": `/tmp/thumbs/${id}_1440p.jpg`,
      "4k": `/tmp/thumbs/${id}_4k.jpg`,
    },
    preview_path: "",
    web_meta: null,
    folder_id: null,
    ...overrides,
  };
}

export function sampleRendererImage(id: number, overrides?: Partial<rendererImage>): rendererImage {
  return {
    ...sampleImage(id),
    time: null,
    ...overrides,
  };
}

export function samplePlaylist(id: number, name?: string, overrides?: Partial<Playlist>): Playlist {
  return {
    id,
    name: name ?? `Playlist ${id}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    configuration: {
      type: "timer",
      interval: 300,
      order: "ordered",
      show_animations: true,
      always_start_on_first_image: false,
    },
    images: [],
    ...overrides,
  };
}

export function sampleFolder(id: number, name?: string, overrides?: Partial<Folder>): Folder {
  return {
    id,
    name: name ?? `Folder ${id}`,
    parent_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function sampleMonitor(name: string, overrides?: Partial<Monitor>): Monitor {
  return {
    name,
    width: 1920,
    height: 1080,
    x: 0,
    y: 0,
    scale: 1.0,
    refresh_rate: 60.0,
    transform: 0,
    ...overrides,
  };
}

export function sampleHistoryEntry(
  id: number,
  overrides?: Partial<ImageHistoryEntry>,
): ImageHistoryEntry {
  return {
    id,
    image_id: id,
    image_name: `image_${id}.jpg`,
    monitors: ["HDMI-A-1"],
    mode: "individual",
    set_at: new Date().toISOString(),
    source: { type: "manual" },
    backend: "awww",
    ...overrides,
  };
}
