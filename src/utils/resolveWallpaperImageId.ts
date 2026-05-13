import type { WallpaperCurrent } from "../../electron/daemon-go-types";

/**
 * Maps a live compositor monitor name to the image id shown on that display,
 * using GET /wallpaper/current slots. Handles shared-wallpaper modes when
 * per-monitor rows are missing after compositor renames.
 */
export function resolveWallpaperImageId(
  current: WallpaperCurrent,
  monitorName: string,
): number | null {
  const slots = current.monitors ?? [];

  const direct = slots.find((s) => s.monitor_name === monitorName);
  if (direct) return direct.image_id;

  const mode = current.mode;
  if ((mode === "clone" || mode === "extend") && slots.length > 0 && current.image_id > 0) {
    return current.image_id;
  }

  return null;
}
