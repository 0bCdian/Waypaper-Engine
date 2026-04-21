/**
 * Classifies a web wallpaper manifest `preview` asset path for gallery playback.
 * GIF and WebP use the package preview file on the card (`<img src=preview>`): animated assets
 * and the daemon thumbnail pipeline does not reliably replace animated WebP. Static .png/.jpg use
 * generated thumbnails only.
 */
const VIDEO_PREVIEW_EXT = new Set([".mp4", ".webm", ".mkv", ".mov", ".avi"]);

export type WebPreviewPlaybackKind = "animatedImage" | "video";

export function webPreviewPlaybackKind(
  previewPath: string | undefined | null,
): WebPreviewPlaybackKind | null {
  const p = previewPath?.trim();
  if (!p) return null;
  const lower = p.toLowerCase();
  const dot = lower.lastIndexOf(".");
  const ext = dot >= 0 ? lower.slice(dot) : "";
  if (ext === ".gif" || ext === ".webp") return "animatedImage";
  if (VIDEO_PREVIEW_EXT.has(ext)) return "video";
  return null;
}
