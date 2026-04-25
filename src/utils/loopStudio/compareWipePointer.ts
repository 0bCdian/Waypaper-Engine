/**
 * Map pointer X to a 0..1 wipe mix for a <canvas> using CSS `object-contain`, where
 * the bitmap (canvas width/height attributes) may be letterboxed inside the element box.
 */
export function clientXToWipeMix(
  clientX: number,
  rect: Pick<DOMRect, "left" | "width" | "height">,
  canvasWidth: number,
  canvasHeight: number,
): number | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  if (canvasWidth <= 0 || canvasHeight <= 0) return null;
  const ar = canvasWidth / canvasHeight;
  const boxAr = rect.width / rect.height;
  let fitW: number;
  let offX: number;
  if (boxAr > ar) {
    fitW = rect.height * ar;
    offX = (rect.width - fitW) / 2;
  } else {
    fitW = rect.width;
    offX = 0;
  }
  if (fitW <= 0) return null;
  const x = clientX - rect.left - offX;
  return Math.min(1, Math.max(0, x / fitW));
}
