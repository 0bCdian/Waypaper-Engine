/**
 * Cheap horizontal-line RGB similarity between two ImageBitmaps (0 = no match, 1 = identical strip).
 */
export function computeLoopMatchScore(outFrame: ImageBitmap, inFrame: ImageBitmap): number {
  const w = 320;
  const h = 180;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const tx = canvas.getContext("2d", { willReadFrequently: true });
  if (!tx) return 0;

  tx.drawImage(outFrame, 0, 0, w, h);
  const dOut = tx.getImageData(0, (h / 2) | 0, w, 1).data;

  tx.drawImage(inFrame, 0, 0, w, h);
  const dIn = tx.getImageData(0, (h / 2) | 0, w, 1).data;

  let diff = 0;
  for (let i = 0; i < dOut.length; i += 4) {
    diff += Math.abs(dOut[i] - dIn[i]);
    diff += Math.abs(dOut[i + 1] - dIn[i + 1]);
    diff += Math.abs(dOut[i + 2] - dIn[i + 2]);
  }
  const maxDiff = w * 255 * 3;
  return 1 - diff / maxDiff;
}
