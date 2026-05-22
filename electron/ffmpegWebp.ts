import { existsSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { platform } from "node:os";

/**
 * Same resolution order as the Go daemon: PATH first, then common absolute paths.
 */
export function resolveFFmpeg(): string {
  try {
    const p = execFileSync("which", ["ffmpeg"], { encoding: "utf8" }).trim();
    if (p) return p;
  } catch {
    /* ignore */
  }
  if (platform() === "win32") {
    return "";
  }
  for (const c of ["/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/opt/homebrew/bin/ffmpeg"]) {
    if (existsSync(c)) return c;
  }
  return "";
}

export type FfmpegWebpResult = { ok: true } | { ok: false; message: string };

/**
 * Encode a numbered PNG sequence `preview-0001.png` … in `framesDir` into one animated WebP.
 */
export function ffmpegPngSequenceToAnimatedWebp(
  ffmpegPath: string,
  framesDir: string,
  frameCount: number,
  fps: number,
  outFile: string,
): FfmpegWebpResult {
  if (frameCount < 1) {
    return { ok: false, message: "no frames" };
  }
  const r = spawnSync(
    ffmpegPath,
    [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-framerate",
      String(fps),
      "-i",
      "preview-%04d.png",
      "-c:v",
      "libwebp",
      "-lossless",
      "0",
      "-q:v",
      "85",
      "-compression_level",
      "6",
      "-preset",
      "default",
      "-loop",
      "0",
      outFile,
    ],
    { cwd: framesDir, encoding: "utf-8" },
  );
  if (r.error) {
    return { ok: false, message: String(r.error.message) };
  }
  if (r.status !== 0) {
    return {
      ok: false,
      message: (r.stderr as string) || `ffmpeg exited ${r.status}`,
    };
  }
  return { ok: true };
}
