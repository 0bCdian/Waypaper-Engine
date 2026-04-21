import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { MAX_PREVIEW_FRAMES } from "../src/shaderStudio/captureShaderPreviewPngs";
import { addPreviewToWaypaperJsonString } from "../src/shaderStudio/waypaperManifestPreview";
import { ffmpegPngSequenceToAnimatedWebp, resolveFFmpeg } from "./ffmpegWebp";
import { logger } from "./logger";

/**
 * Writes `preview.webp` into `packageDir` and patches `waypaper.json` with `"preview":"preview.webp"`.
 * No-op if buffers empty or ffmpeg unavailable / encode fails.
 */
export async function writeAnimatedWebpPreviewFromPngs(
  packageDir: string,
  previewPngBuffers: Uint8Array[],
  previewFps: number,
): Promise<void> {
  const n = Math.min(MAX_PREVIEW_FRAMES, previewPngBuffers.length);
  if (n < 1) return;
  const ffmpeg = resolveFFmpeg();
  if (!ffmpeg) {
    logger.warn("shader preview: ffmpeg not found; skipping preview.webp");
    return;
  }
  const fps = Number.isFinite(previewFps) && previewFps > 0 ? previewFps : 24;
  const wd = await mkdtemp(join(tmpdir(), "waypaper-preview-"));
  try {
    for (let i = 0; i < n; i++) {
      const name = `preview-${String(i + 1).padStart(4, "0")}.png`;
      await writeFile(join(wd, name), previewPngBuffers[i]!);
    }
    const outAbs = join(packageDir, "preview.webp");
    const enc = ffmpegPngSequenceToAnimatedWebp(ffmpeg, wd, n, fps, outAbs);
    if (!enc.ok) {
      logger.warn({ err: enc.message }, "shader preview: ffmpeg webp encode failed");
      return;
    }
    const manifestPath = join(packageDir, "waypaper.json");
    const raw = await readFile(manifestPath, "utf8");
    await writeFile(manifestPath, addPreviewToWaypaperJsonString(raw, "preview.webp"), "utf8");
  } finally {
    await rm(wd, { recursive: true, force: true });
  }
}
