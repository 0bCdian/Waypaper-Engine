import type { Monitor } from "../../electron/daemon-go-types";

/** Four quality states for a wallpaper against a target monitor. */
export type ResolutionMatchState = "exact" | "good" | "upscale" | "crop";

export interface ResolutionMatch {
  state: ResolutionMatchState;
  /** Human-readable label for UI display. */
  label: string;
  /** DaisyUI badge variant. */
  badgeClass: "badge-success" | "badge-neutral" | "badge-warning";
}

/**
 * Parse a Wallhaven resolution string like "1920x1080" into { w, h }.
 * Returns null if the string cannot be parsed.
 */
export function parseWallhavenResolution(resolution: string): { w: number; h: number } | null {
  const match = /^(\d+)[xX×](\d+)$/.exec(resolution.trim());
  if (!match) return null;
  const w = Number(match[1]);
  const h = Number(match[2]);
  if (w <= 0 || h <= 0) return null;
  return { w, h };
}

/**
 * Compute how well a wallpaper resolution matches a monitor.
 *
 * Rules (evaluated top-down, first match wins):
 * 1. Crop  — aspect-ratio delta > 25% regardless of size.
 * 2. Upscale — wallpaper is smaller than the monitor in width OR height.
 * 3. Exact  — wallpaper covers the monitor AND aspect-ratio delta ≤ 2%.
 * 4. Good   — wallpaper covers the monitor AND aspect-ratio delta > 2%.
 *
 * Returns null if the resolution string cannot be parsed.
 */
export function computeResolutionMatch(
  wpResolution: string,
  monitor: Pick<Monitor, "width" | "height">,
): ResolutionMatch | null {
  const parsed = parseWallhavenResolution(wpResolution);
  if (!parsed) return null;

  const { w: wpW, h: wpH } = parsed;
  const { width: monW, height: monH } = monitor;

  const wpAR = wpW / wpH;
  const monAR = monW / monH;
  const arDelta = Math.abs(wpAR - monAR) / monAR;

  // 1. Heavy crop regardless of size
  if (arDelta > 0.25) {
    return { state: "crop", label: "Crop", badgeClass: "badge-warning" };
  }

  // 2. Wallpaper is smaller than the monitor
  if (wpW < monW || wpH < monH) {
    const scaleNeeded = Math.max(monW / wpW, monH / wpH);
    const scaleFmt = scaleNeeded.toFixed(1);
    return {
      state: "upscale",
      label: `Upscale ${scaleFmt}×`,
      badgeClass: "badge-warning",
    };
  }

  // 3 & 4. Wallpaper covers the monitor — exact vs good
  if (arDelta <= 0.02) {
    return { state: "exact", label: "Exact", badgeClass: "badge-success" };
  }

  return { state: "good", label: "Good", badgeClass: "badge-neutral" };
}

/**
 * Return the largest monitor from a list, measured by pixel count.
 * Returns null if the list is empty.
 */
export function largestMonitor<T extends Pick<Monitor, "width" | "height">>(
  monitors: T[],
): T | null {
  if (monitors.length === 0) return null;
  return monitors.reduce((best, m) => (m.width * m.height > best.width * best.height ? m : best));
}
