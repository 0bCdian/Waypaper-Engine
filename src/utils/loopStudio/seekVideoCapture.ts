/**
 * Helpers for grabbing decoded frames from a hidden <video> used as a seek slave
 * (separate from the playing element so we can sample in/out without stalling preview).
 */

const HAVE_CURRENT_DATA = 2; // HTMLMediaElement.HAVE_CURRENT_DATA

/**
 * Resolves when the element has intrinsic dimensions and at least one decoded frame,
 * or after `timeoutMs` (whichever comes first).
 */
export function waitUntilVideoCanSample(vs: HTMLVideoElement, timeoutMs = 10_000): Promise<boolean> {
  if (vs.readyState >= HAVE_CURRENT_DATA && vs.videoWidth > 0 && vs.videoHeight > 0) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(tmr);
      vs.removeEventListener("loadeddata", onData);
      vs.removeEventListener("loadedmetadata", onMeta);
      resolve(ok);
    };
    const tmr = window.setTimeout(() => finish(false), timeoutMs);
    const check = () => {
      if (vs.readyState >= HAVE_CURRENT_DATA && vs.videoWidth > 0 && vs.videoHeight > 0) {
        finish(true);
      }
    };
    const onData = () => check();
    const onMeta = () => check();
    vs.addEventListener("loadeddata", onData);
    vs.addEventListener("loadedmetadata", onMeta);
    check();
  });
}

/**
 * Snapshot the current decoded frame. Prefer intrinsic crop so layout/CSS size of the
 * element does not shrink the bitmap (important for off-screen / minimal layout videos).
 */
export async function createImageBitmapFromVideo(vs: HTMLVideoElement): Promise<ImageBitmap | null> {
  try {
    const w = vs.videoWidth;
    const h = vs.videoHeight;
    if (w > 0 && h > 0) return await createImageBitmap(vs, 0, 0, w, h);
    return await createImageBitmap(vs);
  } catch {
    return null;
  }
}
