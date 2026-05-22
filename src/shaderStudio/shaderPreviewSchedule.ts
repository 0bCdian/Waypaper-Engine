/** Seconds at the start of each preview frame (frame 0 → 0). */
export function deterministicPreviewTimes(frameCount: number, dt: number): number[] {
  if (frameCount < 1) return [];
  return Array.from({ length: frameCount }, (_, i) => i * dt);
}

export const DEFAULT_PREVIEW_WIDTH = 640;
export const DEFAULT_PREVIEW_HEIGHT = 360;
export const DEFAULT_PREVIEW_FRAME_COUNT = 90;
/** Fixed simulation timestep (seconds) for every preview frame, including frame 0. */
export const DEFAULT_PREVIEW_DT = 1 / 60;

/** Shadertoy-style “released” mouse: xy 0, zw negative. */
export const NEUTRAL_SHADERTOY_MOUSE: [number, number, number, number] = [0, 0, -1, -1];

/** Deterministic wall-clock substitute for `iDate`. */
export const FIXED_PREVIEW_IDATE: [number, number, number, number] = [1970, 1, 1, 0];
