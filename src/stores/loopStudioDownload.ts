import { create } from "zustand";
import { asYoutubeDownloadEvent } from "@/shared/youtubeDownload";

/**
 * Mirrors the background yt-dlp job that runs in the Electron main process.
 * Because this store is a module-level singleton it outlives the Loop Studio
 * route component — a download started here keeps progressing (and finishes)
 * even while the user is on a different route.
 */
export type DownloadStatus = "idle" | "downloading" | "done" | "error";

interface State {
  status: DownloadStatus;
  /** Job id of the active/last download; null until the start IPC resolves. */
  jobId: string | null;
  url: string;
  percent: number;
  /** Set on "done" — the temp-file path the renderer should load + import. */
  filePath: string | null;
  errorMessage: string | null;
}

interface Actions {
  start: (url: string) => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

const initial: State = {
  status: "idle",
  jobId: null,
  url: "",
  percent: 0,
  filePath: null,
  errorMessage: null,
};

/** Job ids whose late events must be dropped (cancelled or superseded). */
const ignoredJobs = new Set<string>();
let listenerRegistered = false;

export const useLoopDownloadStore = create<State & Actions>()((set, get) => {
  function ensureListener() {
    if (listenerRegistered) return;
    const api = typeof window !== "undefined" ? window.API_RENDERER : undefined;
    if (!api) return;
    listenerRegistered = true;
    api.onYoutubeDownloadEvent((raw) => {
      const ev = asYoutubeDownloadEvent(raw);
      if (!ev) return;
      if (ignoredJobs.has(ev.jobId)) return;
      // Only one download runs at a time; any non-stale event while we are
      // downloading belongs to it (jobId may still be null pre-start-resolve).
      if (get().status !== "downloading") return;
      switch (ev.type) {
        case "progress":
          set({ percent: ev.percent });
          break;
        case "done":
          set({ status: "done", percent: 100, filePath: ev.filePath });
          break;
        case "error":
          set({ status: "error", errorMessage: ev.message });
          break;
        case "canceled":
          set(initial);
          break;
      }
    });
  }

  return {
    ...initial,

    start: async (url: string) => {
      if (get().status === "downloading") return;
      const trimmed = url.trim();
      ensureListener();
      set({ ...initial, status: "downloading", url: trimmed });
      const api = window.API_RENDERER;
      try {
        const { jobId } = await api.startYoutubeDownload(trimmed);
        if (get().status === "downloading") {
          set({ jobId });
        } else {
          // Cancelled (or already finished) before the start IPC resolved —
          // kill the now-orphaned job so it does not run uselessly.
          ignoredJobs.add(jobId);
          void api.cancelYoutubeDownload(jobId);
        }
      } catch (e) {
        if (get().status === "downloading") {
          set({
            status: "error",
            errorMessage: e instanceof Error ? e.message : "YouTube download failed",
          });
        }
      }
    },

    cancel: () => {
      const { jobId } = get();
      if (jobId) {
        ignoredJobs.add(jobId);
        void window.API_RENDERER.cancelYoutubeDownload(jobId);
      }
      set(initial);
    },

    reset: () => set(initial),
  };
});
