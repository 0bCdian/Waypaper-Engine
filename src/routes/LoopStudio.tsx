import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import { useLocation } from "react-router-dom";
import type { VideoLoopExportRequest } from "../../electron/daemon-go-types";
import { useFoldersStore } from "@/stores/foldersStore";
import { useImagesStore } from "@/stores/images";
import { useToastStore } from "@/stores/toastStore";
import { useLoopDownloadStore } from "@/stores/loopStudioDownload";
import {
  loopStudioGalleryVideoSrc,
  loopStudioMediaSrc,
} from "@/utils/loopStudio/mediaUrl";
import { waitForGalleryVideoBySourcePath } from "@/utils/loopStudio/waitGalleryImport";
import {
  formatLoopTime,
  formatLoopTimeShort,
  parseLoopTime,
} from "@/utils/loopStudio/timeFormat";
import { isVideoFilePath } from "@/utils/videoFileExtensions";
import { isAllowedYoutubeUrl } from "@/shared/youtubeUrl";
import { daemonClient } from "@/client";
import { Kbd } from "@/components/ui";

async function tryVideoLoopExport(
  imageId: number,
  body: VideoLoopExportRequest,
): Promise<
  | { ok: true; res: Awaited<ReturnType<typeof daemonClient.videoLoopExport>> }
  | { ok: false; error: string }
> {
  try {
    const res = await daemonClient.videoLoopExport(imageId, body);
    return { ok: true, res };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Export failed",
    };
  }
}

async function tryExtractVideoPalette(
  imageId: number,
  timeSeconds: number,
): Promise<
  | {
      ok: true;
      res: Awaited<ReturnType<typeof daemonClient.extractVideoPalette>>;
    }
  | { ok: false; error: string }
> {
  try {
    const res = await daemonClient.extractVideoPalette(imageId, {
      time_seconds: timeSeconds,
    });
    return { ok: true, res };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Palette extract failed",
    };
  }
}

const MIN_LOOP_SPAN = 0.033;
const FULL_LOOP_EPS = 0.06;

export default function LoopStudio() {
  const location = useLocation();
  const addToast = useToastStore((s) => s.addToast);
  const reQueryImages = useImagesStore((s) => s.reQueryImages);
  const images = useImagesStore((s) => s.imagesArray);

  const downloadStatus = useLoopDownloadStore((s) => s.status);
  const downloadPercent = useLoopDownloadStore((s) => s.percent);
  const downloadFilePath = useLoopDownloadStore((s) => s.filePath);
  const downloadError = useLoopDownloadStore((s) => s.errorMessage);
  const startDownload = useLoopDownloadStore((s) => s.start);
  const cancelDownload = useLoopDownloadStore((s) => s.cancel);
  const resetDownload = useLoopDownloadStore((s) => s.reset);

  const videoOptions = useMemo(
    () =>
      images.flatMap((i) =>
        i.media_type === "video" ? [{ id: i.id, name: i.name }] : [],
      ),
    [images],
  );

  const [imageId, setImageId] = useState<number | null>(() => {
    const st = location.state as { imageId?: number } | null;
    return typeof st?.imageId === "number" ? st.imageId : null;
  });
  const [previewOnly, setPreviewOnly] = useState(false);
  const [ffmpegAvailable, setFfmpegAvailable] = useState<boolean | null>(null);
  const [ytDlpAvailable, setYtDlpAvailable] = useState<boolean | null>(null);
  const [mediaSrc, setMediaSrc] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [duration, setDuration] = useState(0);
  const [inPoint, setInPoint] = useState(0);
  const [outPoint, setOutPoint] = useState(0);
  const [playhead, setPlayhead] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [preset, setPreset] =
    useState<VideoLoopExportRequest["preset"]>("webm_vp9");
  const [exportAction, setExportAction] = useState<"replace" | "import_new">(
    "import_new",
  );
  const [reloadToken, setReloadToken] = useState(0);
  const [blendHalvesExport, setBlendHalvesExport] = useState(true);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [previewMuted, setPreviewMuted] = useState(false);
  const [paletteBusy, setPaletteBusy] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  const trimmedMedia = mediaSrc?.trim();
  const playbackSrc = trimmedMedia ? trimmedMedia : null;
  const ytDlpMissing = ytDlpAvailable === false;
  const downloading = downloadStatus === "downloading";

  const videoRef = useRef<HTMLVideoElement>(null);
  const dragRef = useRef<"in" | "out" | "seek" | null>(null);

  const prevLocationStateRef = useRef(location.state);
  if (location.state !== prevLocationStateRef.current) {
    prevLocationStateRef.current = location.state;
    const st = location.state as { imageId?: number } | null;
    if (typeof st?.imageId === "number") {
      setImageId(st.imageId);
      setPreviewOnly(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const check = () => {
      void daemonClient.getCapabilities().then((caps) => {
        if (!cancelled) setFfmpegAvailable(caps.ffmpeg_available);
      });
    };
    check();
    window.addEventListener("focus", check);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", check);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const check = () => {
      void window.API_RENDERER.checkYtDlp()
        .then((r) => {
          if (!cancelled) setYtDlpAvailable(r.available);
        })
        .catch(() => {
          if (!cancelled) setYtDlpAvailable(false);
        });
    };
    check();
    window.addEventListener("focus", check);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", check);
    };
  }, []);

  useEffect(() => {
    if (previewOnly || !imageId) return;
    let cancelled = false;
    void daemonClient
      .getImage(imageId)
      .then((img) => {
        if (cancelled) return;
        const nextSrc =
          img.media_type === "video" ? loopStudioGalleryVideoSrc(img) : null;
        if (img.media_type !== "video") {
          addToast("Selected item is not a video", "error");
          setImageId(null);
        }
        setMediaSrc(nextSrc);
      })
      .catch(() => {
        addToast("Failed to load video from gallery", "error");
      });
    return () => {
      cancelled = true;
    };
  }, [imageId, previewOnly, addToast]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = previewMuted;
  }, [previewMuted]);

  const onLoadedMetadata = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const d = v.duration || 0;
    setDuration(d);
    setInPoint(0);
    setOutPoint(d);
    setPlayhead(0);
    setLoaded(true);
    void v.play().catch(() => {});
  }, []);

  const onLoopStudioKey = useEffectEvent((e: KeyboardEvent) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    )
      return;
    const v = videoRef.current;
    if (!v || !loaded) return;
    const subLoop = outPoint - inPoint < duration - FULL_LOOP_EPS;
    if (e.code === "Space") {
      e.preventDefault();
      if (v.paused) void v.play();
      else v.pause();
    }
    if (e.code === "KeyI") {
      e.preventDefault();
      setInPoint(
        Math.max(0, Math.min(v.currentTime, outPoint - MIN_LOOP_SPAN)),
      );
    }
    if (e.code === "KeyO") {
      e.preventDefault();
      setOutPoint(
        Math.max(inPoint + MIN_LOOP_SPAN, Math.min(v.currentTime, duration)),
      );
    }
    if (e.code === "ArrowLeft") {
      e.preventDefault();
      v.currentTime = Math.max(subLoop ? inPoint : 0, v.currentTime - 1 / 30);
    }
    if (e.code === "ArrowRight") {
      e.preventDefault();
      v.currentTime = Math.min(
        subLoop ? outPoint : duration,
        v.currentTime + 1 / 30,
      );
    }
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => onLoopStudioKey(e);
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const onTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const ct = v.currentTime;
    const subLoop = outPoint - inPoint < duration - FULL_LOOP_EPS;
    if (subLoop) {
      if (ct >= outPoint) v.currentTime = inPoint;
      else if (ct < inPoint) v.currentTime = inPoint;
    }
    setPlayhead(v.currentTime);
  }, [inPoint, outPoint, duration]);

  const pickFromGallery = useCallback((idStr: string) => {
    const id = Number(idStr);
    if (!Number.isFinite(id)) {
      setImageId(null);
      setMediaSrc(null);
      setLoaded(false);
      return;
    }
    setImageId(id);
    setPreviewOnly(false);
    setLoaded(false);
  }, []);

  const pickFromDisk = useCallback(async () => {
    const r = await window.API_RENDERER.openFiles("video");
    const p = r.files?.[0];
    if (!p) return;
    setPreviewOnly(true);
    setImageId(null);
    setLoaded(false);
    setMediaSrc(loopStudioMediaSrc(p));
  }, []);

  const openVideoPathPreview = useCallback(
    (absPath: string) => {
      if (!isVideoFilePath(absPath)) {
        addToast("Not a supported video file type", "error");
        return;
      }
      setPreviewOnly(true);
      setImageId(null);
      setLoaded(false);
      setMediaSrc(loopStudioMediaSrc(absPath));
      setReloadToken((t) => t + 1);
    },
    [addToast],
  );

  const importPathToGallery = useCallback(
    async (absPath: string): Promise<number | null> => {
      const folderId = useFoldersStore.getState().currentFolderId ?? undefined;
      await daemonClient.importImages([absPath], folderId);
      void reQueryImages();
      return waitForGalleryVideoBySourcePath(absPath);
    },
    [reQueryImages],
  );

  // Picks up a finished/failed background download. Runs whenever the studio
  // mounts with a terminal job in the store, so a download that completed
  // while the user was on another route is auto-loaded on return.
  const handleDownloadOutcome = useEffectEvent(() => {
    if (downloadStatus === "done") {
      const filePath = downloadFilePath;
      resetDownload();
      if (!filePath) return;
      openVideoPathPreview(filePath);
      addToast("YouTube video ready — importing to gallery…", "success", 4000);
      setAttaching(true);
      importPathToGallery(filePath)
        .then((galleryId) => {
          if (galleryId !== null) {
            setPreviewOnly(false);
            setImageId(galleryId);
            addToast(
              "Linked to gallery — palette and export are enabled.",
              "success",
              4000,
            );
          } else {
            addToast(
              "Still importing — pick the video from the list shortly to enable FFmpeg tools.",
              "warning",
              7000,
            );
          }
        })
        .catch(() => addToast("Failed to import the downloaded video", "error"))
        .finally(() => setAttaching(false));
    } else if (downloadStatus === "error") {
      addToast(downloadError ?? "YouTube download failed", "error");
      resetDownload();
    }
  });

  useEffect(() => {
    handleDownloadOutcome();
  }, [downloadStatus]);

  const submitYoutubeDownload = useCallback(
    (url: string) => {
      const trimmed = url.trim();
      if (!trimmed) {
        addToast("Paste a YouTube URL", "error");
        return;
      }
      if (ytDlpMissing) {
        addToast("yt-dlp is not installed", "error");
        return;
      }
      if (downloading || attaching) {
        addToast("A download is already running", "info", 3000);
        return;
      }
      setYoutubeUrl("");
      void startDownload(trimmed);
    },
    [addToast, ytDlpMissing, downloading, attaching, startDownload],
  );

  const gatherPathsFromDrop = (e: DragEvent): string[] => {
    const out: string[] = [];
    const { files } = e.dataTransfer;
    for (let i = 0; i < files.length; i++) {
      try {
        const p = window.API_RENDERER.getPathForFile(files[i]!);
        if (p) out.push(p);
      } catch {
        /* not a file path */
      }
    }
    if (out.length === 0) {
      const raw =
        e.dataTransfer.getData("text/uri-list") ||
        e.dataTransfer.getData("text/plain");
      for (const line of raw.split(/\r?\n/)) {
        const t = line.trim();
        if (t.startsWith("file://")) {
          out.push(decodeURIComponent(t.replace(/^file:\/\//, "")));
        }
      }
    }
    return out;
  };

  const gatherHttpUrlsFromDrop = (e: DragEvent): string[] => {
    const raw =
      e.dataTransfer.getData("text/uri-list") ||
      e.dataTransfer.getData("text/plain");
    return raw.split(/\r?\n/).flatMap((s) => {
      const t = s.trim();
      return /^https?:\/\//i.test(t) ? [t] : [];
    });
  };

  const onLoopStudioDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const urls = gatherHttpUrlsFromDrop(e);
      for (const u of urls) {
        if (isAllowedYoutubeUrl(u)) {
          submitYoutubeDownload(u);
          return;
        }
      }
      if (urls.length > 0) {
        addToast(
          "URL drop: only YouTube links are supported here",
          "info",
          3500,
        );
        return;
      }
      const paths = gatherPathsFromDrop(e);
      const videoPath = paths.find((p) => isVideoFilePath(p));
      if (videoPath) {
        openVideoPathPreview(videoPath);
        return;
      }
      if (paths.length > 0) {
        addToast("Drop a video file (.mp4, .webm, …)", "warning", 3000);
      }
    },
    [addToast, submitYoutubeDownload, openVideoPathPreview],
  );

  const clearWorkspace = useCallback(() => {
    cancelDownload();
    const v = videoRef.current;
    if (v) v.pause();
    setImageId(null);
    setPreviewOnly(false);
    setMediaSrc(null);
    setLoaded(false);
    setDuration(0);
    setInPoint(0);
    setOutPoint(0);
    setPlayhead(0);
    setYoutubeUrl("");
    setExportOpen(false);
    setAttaching(false);
    setReloadToken((t) => t + 1);
    setClearConfirmOpen(false);
  }, [cancelDownload]);

  const onClearClick = useCallback(() => {
    if (downloading) {
      setClearConfirmOpen(true);
      return;
    }
    clearWorkspace();
  }, [downloading, clearWorkspace]);

  const runExport = useCallback(async () => {
    if (!imageId) {
      addToast("Choose a gallery video to export", "error");
      return;
    }
    setExporting(true);
    const body: VideoLoopExportRequest = {
      in_seconds: inPoint,
      out_seconds: outPoint,
      preset,
      action: exportAction,
      folder_id: useFoldersStore.getState().currentFolderId ?? undefined,
      blend_halves: blendHalvesExport,
    };
    const exportResult = await tryVideoLoopExport(imageId, body);
    if (exportResult.ok) {
      const res = exportResult.res;
      addToast(
        exportAction === "replace"
          ? "Video replaced in gallery"
          : `Imported new video (id ${res.image_id})`,
        "success",
        4000,
      );
      setExportOpen(false);
      reQueryImages();
      if (exportAction === "import_new") {
        setImageId(res.image_id);
        setPreviewOnly(false);
        void daemonClient.getImage(res.image_id).then((img) => {
          setMediaSrc(loopStudioGalleryVideoSrc(img));
          setLoaded(false);
          setReloadToken((t) => t + 1);
        });
      } else {
        void daemonClient.getImage(imageId).then((img) => {
          setMediaSrc(loopStudioGalleryVideoSrc(img));
          setLoaded(false);
          setReloadToken((t) => t + 1);
        });
      }
    } else {
      addToast(exportResult.error, "error");
    }
    setExporting(false);
  }, [
    imageId,
    inPoint,
    outPoint,
    preset,
    exportAction,
    blendHalvesExport,
    addToast,
    reQueryImages,
  ]);

  const runExtractPaletteFromPlayhead = useCallback(async () => {
    if (!imageId) {
      addToast("Choose a gallery video first", "error");
      return;
    }
    if (ffmpegAvailable === false) {
      addToast("ffmpeg not available", "error");
      return;
    }
    setPaletteBusy(true);
    const result = await tryExtractVideoPalette(imageId, playhead);
    if (result.ok) {
      addToast(
        `Saved ${result.res.colors.length} palette colors to the gallery`,
        "success",
        3500,
      );
      void reQueryImages();
    } else {
      addToast(result.error, "error");
    }
    setPaletteBusy(false);
  }, [imageId, ffmpegAvailable, playhead, addToast, reQueryImages]);

  const pct = (t: number) => (duration ? (t / duration) * 100 : 0);
  const tAt = (p: number) => Math.max(0, Math.min(duration, p * duration));

  const timelineRef = useRef<HTMLDivElement>(null);

  const onTimelineMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const ip = pct(inPoint) / 100;
    const op = pct(outPoint) / 100;
    const di = Math.abs(p - ip);
    const dop = Math.abs(p - op);
    const thr = 0.03;
    const t = tAt(p);
    dragRef.current =
      di < thr && di <= dop ? "in" : dop < thr && dop < di ? "out" : "seek";
    if (dragRef.current === "seek") {
      const v = videoRef.current;
      if (v) v.currentTime = t;
    } else if (dragRef.current === "in") {
      setInPoint(Math.max(0, Math.min(t, outPoint - MIN_LOOP_SPAN)));
    } else {
      setOutPoint(Math.max(inPoint + MIN_LOOP_SPAN, Math.min(t, duration)));
    }
  };

  const onTimelineMove = useEffectEvent((e: MouseEvent) => {
    if (!dragRef.current) return;
    const el = timelineRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const t = Math.max(0, Math.min(duration, p * duration));
    if (dragRef.current === "seek") {
      const v = videoRef.current;
      if (v) v.currentTime = t;
    } else if (dragRef.current === "in") {
      setInPoint(Math.max(0, Math.min(t, outPoint - MIN_LOOP_SPAN)));
    } else if (dragRef.current === "out") {
      setOutPoint(Math.max(inPoint + MIN_LOOP_SPAN, Math.min(t, duration)));
    }
  });

  const onTimelineUp = useEffectEvent(() => {
    dragRef.current = null;
  });

  useEffect(() => {
    const onMove = (e: MouseEvent) => onTimelineMove(e);
    const onUp = () => onTimelineUp();
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col gap-2 overflow-hidden px-2 py-2 sm:gap-3 sm:px-4 sm:py-3"
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={onLoopStudioDrop}
    >
      <header className="flex shrink-0 items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-base-content sm:text-2xl">
            Loop Studio
          </h1>
          <p
            className="line-clamp-2 text-xs sm:line-clamp-none sm:text-sm"
            style={{ color: "var(--wp-text-muted)" }}
          >
            Find in/out points for a seamless loop. Sub-loop preview uses coarse{" "}
            <code>timeupdate</code> jumps; export bakes a seamless file for
            native <code>video loop</code> playback.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-outline btn-sm shrink-0"
          onClick={onClearClick}
          title="Discard everything in Loop Studio and start from scratch"
        >
          Clear workspace
        </button>
      </header>

      <div className="alert alert-info shrink-0 py-1.5 text-xs sm:text-sm">
        <span>
          <strong>Tip:</strong> Space play/pause, <Kbd size="sm">I</Kbd> /{" "}
          <Kbd size="sm">O</Kbd> set in/out, arrows step frames. Drag a video
          file or YouTube URL onto this page. Export requires a gallery video.
        </span>
      </div>

      <div className="card flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border border-base-300 bg-base-200">
        <div className="card-body flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 sm:gap-4 sm:p-4">
          <div className="flex shrink-0 flex-wrap items-end gap-3">
            <div className="form-control min-w-[200px]">
              <label className="label py-0" htmlFor="loop-video-select">
                <span className="label-text">Gallery video</span>
              </label>
              <select
                id="loop-video-select"
                className="select select-bordered select-sm"
                value={imageId ?? ""}
                onChange={(e) => pickFromGallery(e.target.value)}
              >
                <option value="">(Select)</option>
                {videoOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} (#{o.id})
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => void pickFromDisk()}
            >
              Open file (preview only)
            </button>
            <div className="flex min-w-0 flex-1 flex-wrap items-end gap-2 basis-full sm:basis-auto">
              <label
                className="form-control min-w-0 flex-1 sm:min-w-[12rem] sm:max-w-md"
                htmlFor="loop-youtube-url"
              >
                <span className="label py-0 text-xs">YouTube URL</span>
                <input
                  id="loop-youtube-url"
                  type="url"
                  className="input input-bordered input-sm w-full font-mono text-xs"
                  placeholder="https://www.youtube.com/watch?v=…"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  disabled={ytDlpMissing || downloading || attaching}
                />
              </label>
              <button
                type="button"
                className="btn btn-outline btn-sm shrink-0"
                disabled={
                  ytDlpMissing || downloading || attaching || !youtubeUrl.trim()
                }
                onClick={() => submitYoutubeDownload(youtubeUrl)}
              >
                Download (yt-dlp)
              </button>
            </div>
            {previewOnly && (
              <span className="badge badge-warning">
                Preview only (not in gallery)
              </span>
            )}
            {ytDlpMissing ? (
              <p className="w-full text-[11px] text-warning">
                <code className="text-[10px]">yt-dlp</code> is not installed —
                the YouTube download is disabled. Local videos and the gallery
                still work.
              </p>
            ) : (
              <p
                className="w-full text-[11px]"
                style={{ color: "var(--wp-text-faint)" }}
              >
                YouTube needs <code className="text-[10px]">yt-dlp</code> on
                PATH;
              </p>
            )}
          </div>

          {(downloading || attaching) && (
            <div className="flex shrink-0 items-center gap-3 rounded-lg border border-base-300 bg-base-300/40 p-2 sm:p-3">
              {downloading ? (
                <>
                  <span
                    className="shrink-0 text-xs"
                    style={{ color: "var(--wp-text-muted)" }}
                  >
                    Downloading…
                  </span>
                  <progress
                    className="progress progress-primary h-2 flex-1"
                    value={downloadPercent}
                    max={100}
                  />
                  <span
                    className="w-10 shrink-0 text-right text-xs tabular-nums"
                    style={{ color: "var(--wp-text-muted)" }}
                  >
                    {Math.round(downloadPercent)}%
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs shrink-0"
                    title="Cancel download"
                    onClick={() => cancelDownload()}
                  >
                    ✕
                  </button>
                </>
              ) : (
                <>
                  <span className="loading loading-spinner loading-xs shrink-0" />
                  <span
                    className="text-xs"
                    style={{ color: "var(--wp-text-muted)" }}
                  >
                    Importing to gallery…
                  </span>
                </>
              )}
            </div>
          )}

          {!playbackSrc ? (
            <p
              className="shrink-0 text-sm"
              style={{ color: "var(--wp-text-faint)" }}
            >
              Select a gallery video or open a file for preview.
            </p>
          ) : (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
              <div className="relative flex min-h-[11rem] w-full flex-1 items-center justify-center overflow-hidden rounded-lg bg-neutral-950 sm:min-h-[14rem]">
                <video
                  key={`${playbackSrc}-${reloadToken}`}
                  ref={videoRef}
                  className="block max-h-full max-w-full object-contain"
                  src={playbackSrc}
                  loop={outPoint - inPoint >= duration - FULL_LOOP_EPS}
                  preload="auto"
                  playsInline
                  muted={previewMuted}
                  onLoadedMetadata={onLoadedMetadata}
                  onTimeUpdate={onTimeUpdate}
                />
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  title={previewMuted ? "Unmute preview" : "Mute preview"}
                  onClick={() => setPreviewMuted((m) => !m)}
                >
                  {previewMuted ? "🔇" : "🔊"}
                </button>
              </div>

              <div
                ref={timelineRef}
                className="shrink-0 cursor-crosshair select-none rounded-lg border border-base-300 bg-base-300/40 p-2 sm:p-3"
                onMouseDown={onTimelineMouseDown}
                role="presentation"
              >
                <div
                  className="flex justify-between text-[11px] tabular-nums mb-1"
                  style={{ color: "var(--wp-text-faint)" }}
                >
                  <span>{formatLoopTimeShort(0)}</span>
                  <span>{formatLoopTimeShort(duration * 0.25)}</span>
                  <span>{formatLoopTimeShort(duration * 0.5)}</span>
                  <span>{formatLoopTimeShort(duration * 0.75)}</span>
                  <span>{formatLoopTimeShort(duration)}</span>
                </div>
                <div className="relative h-10">
                  <div className="absolute top-1/2 left-0 right-0 h-1.5 -translate-y-1/2 bg-base-300 rounded" />
                  <div
                    className="absolute top-1/2 h-1.5 -translate-y-1/2 bg-primary/30 rounded"
                    style={{
                      left: `${pct(inPoint)}%`,
                      width: `${pct(outPoint) - pct(inPoint)}%`,
                    }}
                  />
                  <div
                    className="absolute top-0 bottom-0 w-3.5 -ml-1.5 flex items-center justify-center cursor-ew-resize z-10"
                    style={{ left: `${pct(inPoint)}%` }}
                  >
                    <div className="w-0.5 h-6 bg-success rounded" />
                  </div>
                  <div
                    className="absolute top-0 bottom-0 w-3.5 -ml-1.5 flex items-center justify-center cursor-ew-resize z-10"
                    style={{ left: `${pct(outPoint)}%` }}
                  >
                    <div className="w-0.5 h-6 bg-warning rounded" />
                  </div>
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-base-content z-20 pointer-events-none"
                    style={{ left: `${pct(playhead)}%` }}
                  >
                    <div className="absolute -top-1 -left-1.5 size-3 rounded-full bg-base-content" />
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="btn btn-circle btn-sm"
                  onClick={() => {
                    const v = videoRef.current;
                    if (!v) return;
                    if (v.paused) {
                      void v.play().catch((e: unknown) => {
                        const msg =
                          e instanceof Error
                            ? e.message
                            : "Playback failed (no valid video source?)";
                        addToast(msg, "error");
                      });
                    } else {
                      v.pause();
                    }
                  }}
                >
                  ▶
                </button>
                <span
                  className="tabular-nums text-sm"
                  style={{ color: "var(--wp-text-muted)" }}
                >
                  {formatLoopTime(playhead)} / {formatLoopTime(duration)}
                </span>
                <span
                  className="text-sm ml-auto"
                  style={{ color: "var(--wp-text-faint)" }}
                >
                  loop span:{" "}
                  <strong className="text-base-content">
                    {outPoint > inPoint
                      ? formatLoopTime(outPoint - inPoint)
                      : "—"}
                  </strong>
                </span>
              </div>

              <div className="flex shrink-0 flex-wrap gap-3">
                <label className="form-control">
                  <span className="label-text text-xs text-success">In</span>
                  <input
                    className="input input-bordered input-sm w-36 font-mono"
                    value={formatLoopTime(inPoint)}
                    onChange={(e) => {
                      const t = parseLoopTime(e.target.value);
                      if (!Number.isNaN(t))
                        setInPoint(
                          Math.max(0, Math.min(t, outPoint - MIN_LOOP_SPAN)),
                        );
                    }}
                  />
                </label>
                <label className="form-control">
                  <span className="label-text text-xs text-warning">Out</span>
                  <input
                    className="input input-bordered input-sm w-36 font-mono"
                    value={formatLoopTime(outPoint)}
                    onChange={(e) => {
                      const t = parseLoopTime(e.target.value);
                      if (!Number.isNaN(t))
                        setOutPoint(
                          Math.max(
                            inPoint + MIN_LOOP_SPAN,
                            Math.min(t, duration),
                          ),
                        );
                    }}
                  />
                </label>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={
                    !imageId ||
                    previewOnly ||
                    ffmpegAvailable === false ||
                    paletteBusy ||
                    duration <= 0
                  }
                  title={
                    ffmpegAvailable === false
                      ? "ffmpeg not found — install it and reopen this page"
                      : "Dominant colors from the frame at the playhead (same algorithm as image import)"
                  }
                  onClick={() => void runExtractPaletteFromPlayhead()}
                >
                  {paletteBusy ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    "Palette from playhead"
                  )}
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={
                    !imageId || previewOnly || ffmpegAvailable === false
                  }
                  title={
                    ffmpegAvailable === false
                      ? "ffmpeg not found — install it and reopen this page"
                      : undefined
                  }
                  onClick={() => setExportOpen(true)}
                >
                  Export with FFmpeg…
                </button>
                {ffmpegAvailable === false && (
                  <span className="text-xs text-warning self-center">
                    ffmpeg not installed
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <dialog className={`modal ${exportOpen ? "modal-open" : ""}`}>
        <div className="modal-box">
          <h3 className="font-semibold text-lg">Export loop</h3>
          <p className="text-sm py-2" style={{ color: "var(--wp-text-muted)" }}>
            Re-encodes the trim for WebKit <code>video loop</code>. Audio is
            stripped. Plain trim is a hard cut; with midpoint crossfade, FFmpeg
            splits the span in two and xfades the join (output is slightly
            shorter than the span). Falls back to trim if xfade fails.
          </p>
          <label className="label cursor-pointer justify-start gap-2 py-1">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={blendHalvesExport}
              onChange={(e) => setBlendHalvesExport(e.target.checked)}
            />
            <span className="label-text text-sm">
              Midpoint crossfade (smoother join; recommended)
            </span>
          </label>
          <div className="form-control">
            <span className="label-text">Preset</span>
            <select
              className="select select-bordered select-sm"
              value={preset}
              onChange={(e) =>
                setPreset(e.target.value as VideoLoopExportRequest["preset"])
              }
            >
              <option value="webm_vp9">WebM VP9 (smaller)</option>
              <option value="mp4_h264">MP4 H.264 (compatible)</option>
            </select>
          </div>
          <div className="form-control mt-2">
            <span className="label-text">Apply</span>
            <div className="flex flex-col gap-2">
              <label className="label cursor-pointer justify-start gap-2">
                <input
                  type="radio"
                  className="radio radio-sm"
                  checked={exportAction === "import_new"}
                  onChange={() => setExportAction("import_new")}
                />
                <span className="label-text">Import new copy to gallery</span>
              </label>
              <label className="label cursor-pointer justify-start gap-2">
                <input
                  type="radio"
                  className="radio radio-sm"
                  checked={exportAction === "replace"}
                  onChange={() => setExportAction("replace")}
                />
                <span className="label-text">
                  Replace gallery file (same id)
                </span>
              </label>
            </div>
          </div>
          <div className="modal-action">
            <button
              type="button"
              className="btn"
              onClick={() => setExportOpen(false)}
              disabled={exporting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={exporting}
              onClick={() => void runExport()}
            >
              {exporting ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                "Export"
              )}
            </button>
          </div>
        </div>
        <button
          type="button"
          className="modal-backdrop bg-black/50"
          aria-label="close"
          onClick={() => setExportOpen(false)}
        />
      </dialog>

      <dialog className={`modal ${clearConfirmOpen ? "modal-open" : ""}`}>
        <div className="modal-box">
          <h3 className="font-semibold text-lg">Clear workspace?</h3>
          <p className="text-sm py-2" style={{ color: "var(--wp-text-muted)" }}>
            A YouTube download is still in progress. Clearing the workspace
            cancels it and discards everything currently in Loop Studio.
          </p>
          <div className="modal-action">
            <button
              type="button"
              className="btn"
              onClick={() => setClearConfirmOpen(false)}
            >
              Keep downloading
            </button>
            <button
              type="button"
              className="btn btn-error"
              onClick={() => clearWorkspace()}
            >
              Cancel download &amp; clear
            </button>
          </div>
        </div>
        <button
          type="button"
          className="modal-backdrop bg-black/50"
          aria-label="close"
          onClick={() => setClearConfirmOpen(false)}
        />
      </dialog>
    </div>
  );
}
