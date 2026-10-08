import { execFile } from "node:child_process";
import { promisify } from "node:util";

export type FfmpegWebpResult = { ok: true } | { ok: false; message: string };

/** Encode a numbered PNG sequence `preview-0001.png` … in `framesDir` into one animated WebP. */
export async function ffmpegPngSequenceToAnimatedWebp(
  ffmpegPath: string,
  framesDir: string,
  frameCount: number,
  fps: number,
  outFile: string,
): Promise<FfmpegWebpResult> {
  if (frameCount < 1) {
    return { ok: false, message: "no frames" };
  }
  try {
    await promisify(execFile)(
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
      { cwd: framesDir },
    );
    return { ok: true };
  } catch (err) {
    const { stderr, message } = err as { stderr?: string; message: string };
    return { ok: false, message: stderr || message };
  }
}
