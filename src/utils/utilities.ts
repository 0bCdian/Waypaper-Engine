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

export function calculateMinResolution(monitors: Monitor[]) {
  let maxWidth = 0;
  let maxHeight = 0;

  for (const monitor of monitors) {
    const effectiveWidth = monitor.width + monitor.x;
    const effectiveHeight = monitor.height + monitor.y;

    if (effectiveWidth > maxWidth) {
      maxWidth = effectiveWidth;
    }

    if (effectiveHeight > maxHeight) {
      maxHeight = effectiveHeight;
    }
  }

  return { x: maxWidth, y: maxHeight };
}
