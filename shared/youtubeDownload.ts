/**
 * Events emitted by a background yt-dlp download job. The same union crosses
 * the Electron main → renderer IPC boundary and is consumed by the renderer's
 * loop-studio download store.
 */
export type YoutubeDownloadEvent =
  | { jobId: string; type: "progress"; percent: number }
  | { jobId: string; type: "done"; filePath: string }
  | { jobId: string; type: "error"; message: string }
  | { jobId: string; type: "canceled" };

/** Narrows an untyped IPC payload to a YoutubeDownloadEvent, or null if it is not one. */
export function asYoutubeDownloadEvent(data: unknown): YoutubeDownloadEvent | null {
  if (typeof data !== "object" || data === null) return null;
  const e = data as Record<string, unknown>;
  if (typeof e.jobId !== "string") return null;
  switch (e.type) {
    case "progress":
      return typeof e.percent === "number"
        ? { jobId: e.jobId, type: "progress", percent: e.percent }
        : null;
    case "done":
      return typeof e.filePath === "string"
        ? { jobId: e.jobId, type: "done", filePath: e.filePath }
        : null;
    case "error":
      return typeof e.message === "string"
        ? { jobId: e.jobId, type: "error", message: e.message }
        : null;
    case "canceled":
      return { jobId: e.jobId, type: "canceled" };
    default:
      return null;
  }
}
