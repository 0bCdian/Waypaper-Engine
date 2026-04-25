import { existsSync } from "node:fs";
import { mkdtemp, readdir } from "node:fs/promises";
import { execFileSync, spawn } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { isAllowedYoutubeUrl } from "../shared/youtubeUrl";
import { logger } from "./logger";

export function resolveYtDlp(): string {
  try {
    const p = execFileSync("which", ["yt-dlp"], { encoding: "utf8" }).trim();
    if (p) return p;
  } catch {
    logger.error("yt-dlp not found");
  }
  for (const c of ["/usr/bin/yt-dlp", "/usr/local/bin/yt-dlp"]) {
    if (existsSync(c)) return c;
  }
  return "";
}

export type YoutubeDownloadResult =
  | { ok: true; filePath: string }
  | { ok: false; message: string };

/**
 * Downloads best merged mp4 (or closest) into a fresh temp directory; returns absolute path to the file.
 */
export async function downloadYoutubeVideo(
  url: string,
): Promise<YoutubeDownloadResult> {
  const trimmed = url.trim();
  if (!trimmed) {
    return { ok: false, message: "URL is empty" };
  }
  if (!isAllowedYoutubeUrl(trimmed)) {
    return { ok: false, message: "Only http(s) YouTube URLs are allowed" };
  }

  const ytDlp = resolveYtDlp();
  if (!ytDlp) {
    return {
      ok: false,
      message: "yt-dlp not found (install and ensure it is on PATH)",
    };
  }

  const dir = await mkdtemp(join(tmpdir(), "waypaper-ytdl-"));
  const outTemplate = join(dir, "video.%(ext)s");

  const args = [
    "--no-playlist",
    "-f",
    "bv*+ba/b",
    "--merge-output-format",
    "mp4",
    "-o",
    outTemplate,
    "--no-mtime",
    trimmed,
  ];

  let exitCode: number;
  try {
    exitCode = await new Promise<number>((resolve, reject) => {
      const child = spawn(ytDlp, args, { stdio: ["ignore", "pipe", "pipe"] });
      child.on("error", reject);
      child.on("close", (c) => resolve(c ?? 1));
    });
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "yt-dlp failed to start",
    };
  }

  if (exitCode !== 0) {
    return { ok: false, message: `yt-dlp exited with code ${exitCode}` };
  }

  const names = await readdir(dir);
  const video = names.find((n) => /\.(mp4|webm|mkv|mov)$/i.test(n));
  if (!video) {
    return {
      ok: false,
      message: "yt-dlp finished but no video file was found",
    };
  }

  return { ok: true, filePath: join(dir, video) };
}
