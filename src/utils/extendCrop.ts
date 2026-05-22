import type { Monitor } from "../../electron/daemon-go-types";

/** A rectangle in logical (layout) pixels. */
export interface LogicalRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ExtendCrop {
  /** Logical-pixel bounding box covering every monitor. */
  bbox: LogicalRect;
  /** This monitor's window within the bbox, origin at the bbox top-left. */
  crop: LogicalRect;
}

/**
 * Normalizes a monitor to logical pixels. Wayland compositors report X/Y in
 * logical coordinates but Width/Height in physical pixels; dividing W/H by the
 * scale factor brings everything into one coordinate space. Mirrors
 * `toLogical` in `daemon/internal/image/splitter.go`.
 */
function toLogical(m: Monitor): LogicalRect {
  const scale = m.scale > 0 ? m.scale : 1;
  return {
    x: m.x,
    y: m.y,
    w: Math.round(m.width / scale),
    h: Math.round(m.height / scale),
  };
}

/**
 * Computes the faithful extend-mode crop for one monitor, replicating the
 * daemon's image splitter (`daemon/internal/image/splitter.go`):
 *
 *   1. Normalize every monitor to logical pixels.
 *   2. Compute the logical bounding box of all monitors.
 *   3. The source image is scaled to *cover* that bounding box.
 *   4. Each monitor crops the sub-rectangle `(x - bboxX, y - bboxY, w, h)`.
 *
 * The renderer reproduces step 3 with CSS `object-fit: cover` on an element
 * sized to `bbox`, and step 4 by offsetting that element inside a clipped
 * monitor-sized window.
 */
export function computeExtendCrop(monitor: Monitor, monitors: Monitor[]): ExtendCrop {
  const logical = (monitors.length > 0 ? monitors : [monitor]).map(toLogical);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const lm of logical) {
    minX = Math.min(minX, lm.x);
    minY = Math.min(minY, lm.y);
    maxX = Math.max(maxX, lm.x + lm.w);
    maxY = Math.max(maxY, lm.y + lm.h);
  }

  const bbox: LogicalRect = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  const me = toLogical(monitor);
  const crop: LogicalRect = { x: me.x - bbox.x, y: me.y - bbox.y, w: me.w, h: me.h };

  return { bbox, crop };
}
