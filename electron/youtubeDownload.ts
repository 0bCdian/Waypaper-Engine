import { existsSync } from "node:fs";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { isAllowedYoutubeUrl } from "../shared/youtubeUrl";
import type { YoutubeDownloadEvent } from "../shared/youtubeDownload";
import { logger } from "./logger";

function resolveYtDlp(): string {
  try {
    const p = execFileSync("which", ["yt-dlp"], { encoding: "utf8" }).trim();
    if (p) return p;
  } catch {
    /* fall through to known locations */
  }
  for (const c of ["/usr/bin/yt-dlp", "/usr/local/bin/yt-dlp"]) {
    if (existsSync(c)) return c;
  }
  return "";
}

/** True if yt-dlp can be found on PATH or at a known location. */
export function isYtDlpAvailable(): boolean {
  return resolveYtDlp() !== "";
}

type ActiveJob = {
  jobId: string;
  child: ChildProcess;
  dir: string;
  canceled: boolean;
};

/** Only one download runs at a time — the loop studio has a single URL box. */
let activeJob: ActiveJob | null = null;

export type StartDownloadResult = { ok: true; jobId: string } | { ok: false; message: string };

type Emit = (event: YoutubeDownloadEvent) => void;

/**
 * Spawns a yt-dlp download in the background and returns immediately with a
 * jobId. Progress and the terminal outcome (done/error/canceled) are delivered
 * through `emit` so they survive the renderer navigating away and back. The
 * process keeps running independent of any renderer route.
 */
export async function startYoutubeDownload(url: string, emit: Emit): Promise<StartDownloadResult> {
  const trimmed = url.trim();
  if (!trimmed) return { ok: false, message: "URL is empty" };
  if (!isAllowedYoutubeUrl(trimmed)) {
    return { ok: false, message: "Only http(s) YouTube URLs are allowed" };
  }
  if (activeJob) {
    return { ok: false, message: "A download is already running" };
  }

  const ytDlp = resolveYtDlp();
  if (!ytDlp) {
    return { ok: false, message: "yt-dlp not found (install and ensure it is on PATH)" };
  }

  const dir = await mkdtemp(join(tmpdir(), "waypaper-ytdl-"));
  const outTemplate = join(dir, "video.%(ext)s");
  const args = [
    "--no-playlist",
    "--newline",
    "-f",
    "bv*+ba/b",
    "--merge-output-format",
    "mp4",
    "-o",
    outTemplate,
    "--no-mtime",
    trimmed,
  ];

  let child: ChildProcess;
  try {
    child = spawn(ytDlp, args, { stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    await rm(dir, { recursive: true, force: true });
    return { ok: false, message: e instanceof Error ? e.message : "yt-dlp failed to start" };
  }

  const jobId = randomUUID();
  const job: ActiveJob = { jobId, child, dir, canceled: false };
  activeJob = job;

  let settled = false;
  const finish = (event: YoutubeDownloadEvent) => {
    if (settled) return;
    settled = true;
    if (activeJob?.jobId === jobId) activeJob = null;
    emit(event);
  };

  child.stdout?.setEncoding("utf8");
  child.stdout?.on("data", (chunk: string) => {
    // yt-dlp with --newline emits "[download]  12.3% of ..." lines; the audio
    // stream restarts the percentage, so the bar may reset once — accepted.
    const re = /\[download\]\s+([\d.]+)%/g;
    let last: number | null = null;
    let m: RegExpExecArray | null;
    while ((m = re.exec(chunk)) !== null) {
      const pct = Number(m[1]);
      if (Number.isFinite(pct)) last = pct;
    }
    if (last != null && !settled) {
      emit({ jobId, type: "progress", percent: Math.min(100, Math.max(0, last)) });
    }
  });

  let stderrTail = "";
  child.stderr?.setEncoding("utf8");
  child.stderr?.on("data", (chunk: string) => {
    stderrTail = (stderrTail + chunk).slice(-8192);
  });

  child.on("error", (err) => {
    void rm(dir, { recursive: true, force: true });
    finish({
      jobId,
      type: "error",
      message: err instanceof Error ? err.message : "yt-dlp failed to start",
    });
  });

  child.on("close", (code) => {
    void (async () => {
      if (job.canceled) {
        await rm(dir, { recursive: true, force: true });
        finish({ jobId, type: "canceled" });
        return;
      }
      if (code !== 0) {
        await rm(dir, { recursive: true, force: true });
        const tail = stderrTail.trim().split(/\r?\n/).filter(Boolean).at(-1);
        finish({ jobId, type: "error", message: tail || `yt-dlp exited with code ${code}` });
        return;
      }
      let names: string[];
      try {
        names = await readdir(dir);
      } catch {
        finish({ jobId, type: "error", message: "Download finished but its folder is unreadable" });
        return;
      }
      const video = names.find((n) => /\.(mp4|webm|mkv|mov)$/i.test(n));
      if (!video) {
        await rm(dir, { recursive: true, force: true });
        finish({ jobId, type: "error", message: "yt-dlp finished but no video file was found" });
        return;
      }
      finish({ jobId, type: "done", filePath: join(dir, video) });
    })().catch((e: unknown) => {
      logger.error({ err: e }, "youtube download close handler failed");
      finish({ jobId, type: "error", message: "Download post-processing failed" });
    });
  });

  return { ok: true, jobId };
}

/** Kills the running download if its jobId matches. Returns true if a job was killed. */
export function cancelYoutubeDownload(jobId: string): boolean {
  if (!activeJob || activeJob.jobId !== jobId) return false;
  activeJob.canceled = true;
  activeJob.child.kill("SIGTERM");
  return true;
}
