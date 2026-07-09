import type { Image, Monitor } from "../../electron/daemon-go-types";
import { webPreviewPlaybackKind } from "./webPreviewPlayback";

export function getThumbnailSrc(
  image: Pick<Image, "thumbnails" | "path"> &
    Partial<Pick<Image, "media_type" | "format" | "preview_path">>,
  preferredSize?: keyof Image["thumbnails"],
): string {
  if (image.media_type === "gif" || image.format === "gif") {
    return image.path;
  }
  if (preferredSize) {
    const val = image.thumbnails?.[preferredSize]?.trim();
    if (val) return val;
  }
  const sized =
    image.thumbnails?.default?.trim() ||
    image.thumbnails?.["720p"]?.trim() ||
    image.thumbnails?.["1080p"]?.trim() ||
    "";
  if (sized) return sized;
  if (image.media_type === "web") {
    const kind = webPreviewPlaybackKind(image.preview_path);
    if (kind === "animatedImage" && image.preview_path) return image.preview_path.trim();
    return "";
  }
  return image.path;
}

export function toSeconds(hours: number, minutes: number) {
  return hours * 3600 + minutes * 60;
}

export function toHoursAndMinutes(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return { hours, minutes };
}

export function parseResolution(resolution: string) {
  const [width, height] = resolution.split("x");
  return { width: parseInt(width, 10), height: parseInt(height, 10) };
}

export interface MonitorLayoutFit {
  /** Multiplier from layout pixels to preview pixels. */
  scale: number;
  /** Scaled size of the whole layout's bounding box. */
  width: number;
  height: number;
  /** Top-left of the bounding box in layout coordinates (can be negative). */
  origin: { x: number; y: number };
}

/**
 * Scales a monitor arrangement so its bounding box fits inside `box`,
 * preserving aspect ratio. Positions relative to the preview are
 * `(monitor.x - origin.x) * scale` / `(monitor.y - origin.y) * scale`.
 */
export function fitMonitorLayout(
  monitors: Monitor[],
  box: { width: number; height: number },
): MonitorLayoutFit {
  if (monitors.length === 0) {
    return { scale: 0, width: 0, height: 0, origin: { x: 0, y: 0 } };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const monitor of monitors) {
    minX = Math.min(minX, monitor.x);
    minY = Math.min(minY, monitor.y);
    maxX = Math.max(maxX, monitor.x + monitor.width);
    maxY = Math.max(maxY, monitor.y + monitor.height);
  }

  const scale = Math.min(box.width / (maxX - minX), box.height / (maxY - minY));
  return {
    scale,
    width: (maxX - minX) * scale,
    height: (maxY - minY) * scale,
    origin: { x: minX, y: minY },
  };
}
