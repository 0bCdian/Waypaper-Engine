import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { useLocation } from "react-router-dom";
import type { VideoLoopExportRequest } from "../../electron/daemon-go-types";
import { useFoldersStore } from "@/stores/foldersStore";
import { useImagesStore } from "@/stores/images";
import { useToastStore } from "@/stores/toastStore";
import { loopStudioGalleryVideoSrc, loopStudioMediaSrc } from "@/utils/loopStudio/mediaUrl";
import { waitForGalleryVideoBySourcePath } from "@/utils/loopStudio/waitGalleryImport";
import { clientXToWipeMix } from "@/utils/loopStudio/compareWipePointer";
import { computeLoopMatchScore } from "@/utils/loopStudio/matchScore";
import { formatLoopTime, formatLoopTimeShort, parseLoopTime } from "@/utils/loopStudio/timeFormat";
import { isVideoFilePath } from "@/utils/videoFileExtensions";
import { isAllowedYoutubeUrl } from "@/shared/youtubeUrl";
import {
  createImageBitmapFromVideo,
  waitUntilVideoCanSample,
} from "@/utils/loopStudio/seekVideoCapture";
import { daemonClient } from "@/client";

const api = window.API_RENDERER;

async function tryDownloadYoutube(url: string): Promise<{ filePath: string } | { error: string }> {
  try {
    const { filePath } = await api.downloadYoutubeVideo(url);
    return { filePath };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "YouTube download failed",
    };
  }
}

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
  | { ok: true; res: Awaited<ReturnType<typeof daemonClient.extractVideoPalette>> }
  | { ok: false; error: string }
> {
  try {
    const res = await daemonClient.extractVideoPalette(imageId, { time_seconds: timeSeconds });
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

type StudioMode = "play" | "compare";

export default function LoopStudio() {
  const location = useLocation();
  const addToast = useToastStore((s) => s.addToast);
  const reQueryImages = useImagesStore((s) => s.reQueryImages);
  const images = useImagesStore((s) => s.imagesArray);

  const videoOptions = useMemo(
    () => images.filter((i) => i.media_type === "video").map((i) => ({ id: i.id, name: i.name })),
    [images],
  );

  const [imageId, setImageId] = useState<number | null>(() => {
    const st = location.state as { imageId?: number } | null;
    return typeof st?.imageId === "number" ? st.imageId : null;
  });
  const [previewOnly, setPreviewOnly] = useState(false);
  const [ffmpegAvailable, setFfmpegAvailable] = useState<boolean | null>(null);
  const [mediaSrc, setMediaSrc] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [duration, setDuration] = useState(0);
  const [inPoint, setInPoint] = useState(0);
  const [outPoint, setOutPoint] = useState(0);
  const [playhead, setPlayhead] = useState(0);
  const [mode, setMode] = useState<StudioMode>("play");
  const [matchPct, setMatchPct] = useState<number | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [preset, setPreset] = useState<VideoLoopExportRequest["preset"]>("webm_vp9");
  const [exportAction, setExportAction] = useState<"replace" | "import_new">("import_new");
  const [reloadToken, setReloadToken] = useState(0);
  const [compareWipe, setCompareWipe] = useState(0.5);
  const [blendHalvesExport, setBlendHalvesExport] = useState(true);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeBusy, setYoutubeBusy] = useState(false);
  const [previewMuted, setPreviewMuted] = useState(false);
  const [paletteBusy, setPaletteBusy] = useState(false);

  const trimmedMedia = mediaSrc?.trim();
  const playbackSrc = trimmedMedia ? trimmedMedia : null;

  const videoRef = useRef<HTMLVideoElement>(null);
  const seekRef = useRef<HTMLVideoElement>(null);
  const canvasPlayRef = useRef<HTMLCanvasElement>(null);
  const canvasCmpRef = useRef<HTMLCanvasElement>(null);
  const previewShellRef = useRef<HTMLDivElement>(null);
  const compareWipeRef = useRef(0.5);
  const rafRef = useRef<number | null>(null);
  const captureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outBitmapRef = useRef<ImageBitmap | null>(null);
  const inBitmapRef = useRef<ImageBitmap | null>(null);
  const dragRef = useRef<"in" | "out" | "seek" | null>(null);
  const captureGenRef = useRef(0);
  const modeRef = useRef<StudioMode>(mode);

  useEffect(() => {
    compareWipeRef.current = compareWipe;
  });

  useEffect(() => {
    modeRef.current = mode;
  });

  const [prevLocationState, setPrevLocationState] = useState(location.state);
  if (location.state !== prevLocationState) {
    setPrevLocationState(location.state);
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
    if (previewOnly || !imageId) return;
    let cancelled = false;
    void daemonClient
      .getImage(imageId)
      .then((img) => {
        if (cancelled) return;
        if (img.media_type !== "video") {
          addToast("Selected item is not a video", "error");
          setImageId(null);
          setMediaSrc(null);
          return;
        }
        setMediaSrc(loopStudioGalleryVideoSrc(img));
      })
      .catch(() => {
        addToast("Failed to load video from gallery", "error");
      });
    return () => {
      cancelled = true;
    };
  }, [imageId, previewOnly, addToast]);

  const stopRaf = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const tickRef = useRef<() => void>(() => {});

  const tickPlayCanvas = useCallback(() => {
    const v = videoRef.current;
    const c = canvasPlayRef.current;
    if (!v || !c || mode !== "play") return;
    if (v.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      const ctx = c.getContext("2d");
      if (ctx) ctx.drawImage(v, 0, 0, c.width, c.height);
    }
    rafRef.current = requestAnimationFrame(() => tickRef.current());
  }, [mode]);

  useEffect(() => {
    tickRef.current = tickPlayCanvas;
  }, [tickPlayCanvas]);

  useEffect(() => {
    if (!loaded || mode !== "play") {
      stopRaf();
      return;
    }
    rafRef.current = requestAnimationFrame(() => tickRef.current());
    return stopRaf;
  }, [loaded, mode, tickPlayCanvas, stopRaf]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = previewMuted;
  }, [previewMuted]);

  const captureFramesRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const scheduleCaptures = useCallback(() => {
    if (captureTimerRef.current) clearTimeout(captureTimerRef.current);
    captureTimerRef.current = setTimeout(() => {
      void captureFramesRef.current();
    }, 300);
  }, []);

  const captureAt = useCallback(async (t: number): Promise<ImageBitmap | null> => {
    const vs = seekRef.current;
    if (!vs) return null;
    if (!(await waitUntilVideoCanSample(vs))) return null;

    const grabAfterSeek = () => createImageBitmapFromVideo(vs);

    if (
      Math.abs(vs.currentTime - t) < 1e-3 &&
      vs.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
    ) {
      return grabAfterSeek();
    }

    return new Promise<ImageBitmap | null>((resolve) => {
      let settled = false;
      const finish = (bmp: ImageBitmap | null) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(tmr);
        resolve(bmp);
      };
      const tmr = window.setTimeout(() => finish(null), 8000);
      const onSeeked = () => {
        const rvfc = (
          vs as HTMLVideoElement & {
            requestVideoFrameCallback?: (cb: () => void) => void;
          }
        ).requestVideoFrameCallback;
        if (typeof rvfc === "function") {
          rvfc.call(vs, () => void grabAfterSeek().then(finish));
        } else {
          window.setTimeout(() => void grabAfterSeek().then(finish), 50);
        }
      };

      vs.addEventListener("seeked", onSeeked, { once: true });
      try {
        vs.currentTime = t;
      } catch {
        finish(null);
        return;
      }

      if (
        Math.abs(vs.currentTime - t) < 1e-3 &&
        vs.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
      ) {
        vs.removeEventListener("seeked", onSeeked);
        void grabAfterSeek().then(finish);
      }
    });
  }, []);

  const drawCompareWipe = useCallback(() => {
    const outB = outBitmapRef.current;
    const inB = inBitmapRef.current;
    const c = canvasCmpRef.current;
    if (!outB || !inB || !c) return;
    const mix = Math.min(1, Math.max(0, compareWipeRef.current));
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const w = c.width;
    const h = c.height;
    const split = mix * w;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, split, h);
    ctx.clip();
    ctx.drawImage(outB, 0, 0, w, h);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.rect(split, 0, Math.max(0, w - split), h);
    ctx.clip();
    ctx.drawImage(inB, 0, 0, w, h);
    ctx.restore();

    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(split, 0);
    ctx.lineTo(split, h);
    ctx.stroke();

    const pillH = 32;
    const pillW = 18;
    const py = h / 2 - pillH / 2;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(split - pillW / 2, py, pillW, pillH, 6);
    } else {
      ctx.rect(split - pillW / 2, py, pillW, pillH);
    }
    ctx.fill();

    ctx.fillStyle = "#222";
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("◀▶", split, h / 2);

    ctx.font = "500 11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(247,167,79,0.95)";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText("OUT", 10, h - 10);
    ctx.fillStyle = "rgba(79,207,122,0.95)";
    ctx.textAlign = "right";
    ctx.fillText("IN", w - 10, h - 10);
  }, []);

  const onWipeMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (modeRef.current !== "compare") return;
      e.preventDefault();
      const canvas = e.currentTarget;
      const sync = (clientX: number) => {
        const rect = canvas.getBoundingClientRect();
        const next = clientXToWipeMix(clientX, rect, canvas.width, canvas.height);
        if (next == null) return;
        compareWipeRef.current = next;
        setCompareWipe(next);
        drawCompareWipe();
      };
      sync(e.clientX);
      const onMove = (ev: MouseEvent) => {
        sync(ev.clientX);
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [drawCompareWipe],
  );

  const captureFrames = useCallback(async () => {
    if (!duration) return;
    const gen = ++captureGenRef.current;
    const prevO = outBitmapRef.current;
    const prevI = inBitmapRef.current;
    const o = await captureAt(outPoint);
    const i = await captureAt(inPoint);
    if (gen !== captureGenRef.current) {
      o?.close();
      i?.close();
      return;
    }
    if (o && i) {
      prevO?.close?.();
      prevI?.close?.();
      outBitmapRef.current = o;
      inBitmapRef.current = i;
      const score = computeLoopMatchScore(o, i);
      setMatchPct(Math.round(score * 100));
      if (modeRef.current === "compare") drawCompareWipe();
    } else {
      o?.close();
      i?.close();
      setMatchPct(null);
      if (modeRef.current === "compare") drawCompareWipe();
    }
  }, [duration, outPoint, inPoint, captureAt, drawCompareWipe]);

  useEffect(() => {
    captureFramesRef.current = captureFrames;
  }, [captureFrames]);

  const layoutPreviewCanvases = useCallback(() => {
    const shell = previewShellRef.current;
    const v = videoRef.current;
    const cPlay = canvasPlayRef.current;
    const cCmp = canvasCmpRef.current;
    if (!shell || !v || !cPlay || !cCmp) return;
    const rect = shell.getBoundingClientRect();
    const vw = v.videoWidth || 1280;
    const vh = v.videoHeight || 720;
    const rw = Math.max(1, Math.floor(rect.width));
    const rh = Math.max(1, Math.floor(rect.height));
    if (rw < 2 || rh < 2) return;
    const ar = vw / vh;
    let dw = rw;
    let dh = rh;
    if (dw / dh > ar) dw = Math.floor(dh * ar);
    else dh = Math.floor(dw / ar);
    dw = Math.max(1, dw);
    dh = Math.max(1, dh);
    if (cPlay.width === dw && cPlay.height === dh && cCmp.width === dw && cCmp.height === dh)
      return;
    cPlay.width = dw;
    cPlay.height = dh;
    cCmp.width = dw;
    cCmp.height = dh;
    scheduleCaptures();
    if (modeRef.current === "compare" && outBitmapRef.current && inBitmapRef.current) {
      drawCompareWipe();
    }
  }, [scheduleCaptures, drawCompareWipe]);

  useEffect(() => {
    scheduleCaptures();
    return () => {
      if (captureTimerRef.current) clearTimeout(captureTimerRef.current);
    };
  }, [inPoint, outPoint, duration, scheduleCaptures]);

  useEffect(() => {
    if (mode === "compare") drawCompareWipe();
  }, [mode, compareWipe, drawCompareWipe]);

  useEffect(() => {
    return () => {
      stopRaf();
      outBitmapRef.current?.close?.();
      inBitmapRef.current?.close?.();
    };
  }, [stopRaf]);

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
    requestAnimationFrame(() => {
      layoutPreviewCanvases();
      scheduleCaptures();
    });
  }, [scheduleCaptures, layoutPreviewCanvases]);

  useEffect(() => {
    if (!loaded || !playbackSrc) return;
    const shell = previewShellRef.current;
    if (!shell) return;
    const ro = new ResizeObserver(() => {
      layoutPreviewCanvases();
    });
    ro.observe(shell);
    layoutPreviewCanvases();
    return () => ro.disconnect();
  }, [loaded, playbackSrc, layoutPreviewCanvases]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
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
        setInPoint(Math.max(0, Math.min(v.currentTime, outPoint - MIN_LOOP_SPAN)));
      }
      if (e.code === "KeyO") {
        e.preventDefault();
        setOutPoint(Math.max(inPoint + MIN_LOOP_SPAN, Math.min(v.currentTime, duration)));
      }
      if (e.code === "KeyC") {
        e.preventDefault();
        setMode((m) => {
          const next = m === "play" ? "compare" : "play";
          modeRef.current = next;
          return next;
        });
        queueMicrotask(() => {
          if (modeRef.current === "compare") {
            void captureFrames();
          }
        });
      }
      if (e.code === "ArrowLeft") {
        e.preventDefault();
        v.currentTime = Math.max(subLoop ? inPoint : 0, v.currentTime - 1 / 30);
      }
      if (e.code === "ArrowRight") {
        e.preventDefault();
        v.currentTime = Math.min(subLoop ? outPoint : duration, v.currentTime + 1 / 30);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [loaded, duration, inPoint, outPoint, captureFrames]);

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

  const downloadAndAttachYoutube = useCallback(
    async (url: string) => {
      const trimmed = url.trim();
      if (!trimmed) {
        addToast("Paste a YouTube URL", "error");
        return;
      }
      setYoutubeBusy(true);
      const result = await tryDownloadYoutube(trimmed);
      if ("filePath" in result) {
        openVideoPathPreview(result.filePath);
        addToast("YouTube video: preview ready; importing to gallery…", "success", 4500);
        const galleryId = await importPathToGallery(result.filePath);
        if (galleryId !== null) {
          setPreviewOnly(false);
          setImageId(galleryId);
          addToast("Linked to gallery row — palette and export are enabled.", "success", 4000);
        } else {
          addToast(
            "Still importing — select the video from the list in a moment to enable FFmpeg tools.",
            "warning",
            7000,
          );
        }
        setYoutubeUrl("");
      } else {
        addToast(result.error, "error");
      }
      setYoutubeBusy(false);
    },
    [addToast, openVideoPathPreview, importPathToGallery],
  );

  const beginCompare = useCallback(() => {
    modeRef.current = "compare";
    setMode("compare");
    void captureFrames();
  }, [captureFrames]);

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
      const raw = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
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
    const raw = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
    return raw
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((u) => /^https?:\/\//i.test(u));
  };

  const onLoopStudioDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const urls = gatherHttpUrlsFromDrop(e);
      for (const u of urls) {
        if (isAllowedYoutubeUrl(u)) {
          void downloadAndAttachYoutube(u);
          return;
        }
      }
      if (urls.length > 0) {
        addToast("URL drop: only YouTube links are supported here", "info", 3500);
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
    [addToast, downloadAndAttachYoutube, openVideoPathPreview],
  );

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
      addToast(`Saved ${result.res.colors.length} palette colors to the gallery`, "success", 3500);
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
    dragRef.current = di < thr && di <= dop ? "in" : dop < thr && dop < di ? "out" : "seek";
    if (dragRef.current === "seek") {
      const v = videoRef.current;
      if (v) v.currentTime = t;
    } else if (dragRef.current === "in") {
      setInPoint(Math.max(0, Math.min(t, outPoint - MIN_LOOP_SPAN)));
    } else {
      setOutPoint(Math.max(inPoint + MIN_LOOP_SPAN, Math.min(t, duration)));
    }
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
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
    };
    const onUp = () => {
      if (dragRef.current) {
        scheduleCaptures();
        dragRef.current = null;
      }
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [duration, inPoint, outPoint, scheduleCaptures]);

  const scoreColor =
    matchPct == null
      ? "badge-ghost"
      : matchPct > 92
        ? "badge-success"
        : matchPct > 80
          ? "badge-warning"
          : "badge-error";

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col gap-2 overflow-hidden px-2 py-2 sm:gap-3 sm:px-4 sm:py-3"
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={onLoopStudioDrop}
    >
      <header className="shrink-0 space-y-1">
        <h1 className="text-xl font-bold text-base-content sm:text-2xl">Loop Studio</h1>
        <p className="line-clamp-2 text-xs text-base-content/60 sm:line-clamp-none sm:text-sm">
          Find in/out points and match the last frame to the first. Sub-loop preview uses coarse{" "}
          <code>timeupdate</code> jumps (not the two-decoder crossfade from a classic loop trimmer);
          export bakes a seamless file for native <code>video loop</code> playback. Compare is two
          still captures of in/out with a wipe, not live blended playback.
        </p>
      </header>

      <div className="alert alert-info shrink-0 py-1.5 text-xs sm:text-sm">
        <span>
          <strong>Tip:</strong> Space play/pause, <kbd className="kbd kbd-sm">I</kbd> /{" "}
          <kbd className="kbd kbd-sm">O</kbd> set in/out, <kbd className="kbd kbd-sm">C</kbd>{" "}
          compare (drag the wipe on the preview), arrows step frames. Drag a video file or YouTube
          URL onto this page. Export requires a gallery video.
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
                <option value="">— Select —</option>
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
                  disabled={youtubeBusy}
                />
              </label>
              <button
                type="button"
                className="btn btn-outline btn-sm shrink-0"
                disabled={youtubeBusy || !youtubeUrl.trim()}
                onClick={() => void downloadAndAttachYoutube(youtubeUrl)}
              >
                {youtubeBusy ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  "Download (yt-dlp)"
                )}
              </button>
            </div>
            {previewOnly && (
              <span className="badge badge-warning">Preview only — not in gallery</span>
            )}
            <p className="w-full text-[11px] text-base-content/50">
              YouTube needs <code className="text-[10px]">yt-dlp</code> on PATH; import runs in the
              background.
            </p>
          </div>

          {!playbackSrc ? (
            <p className="shrink-0 text-sm text-base-content/50">
              Select a gallery video or open a file for preview.
            </p>
          ) : (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
              <div
                ref={previewShellRef}
                className="relative flex min-h-[11rem] w-full flex-1 items-center justify-center overflow-hidden rounded-lg bg-black sm:min-h-[14rem]"
              >
                <canvas
                  ref={canvasPlayRef}
                  className={
                    mode === "play" ? "block max-h-full max-w-full object-contain" : "hidden"
                  }
                  aria-hidden={mode !== "play"}
                />
                <canvas
                  ref={canvasCmpRef}
                  className={
                    mode === "compare"
                      ? "block max-h-full max-w-full cursor-col-resize select-none touch-none object-contain"
                      : "hidden"
                  }
                  aria-hidden={mode !== "compare"}
                  onMouseDown={onWipeMouseDown}
                />
                <video
                  key={`${playbackSrc}-${reloadToken}`}
                  ref={videoRef}
                  className="hidden"
                  src={playbackSrc}
                  loop={outPoint - inPoint >= duration - FULL_LOOP_EPS}
                  preload="auto"
                  playsInline
                  muted={previewMuted}
                  onLoadedMetadata={onLoadedMetadata}
                  onTimeUpdate={onTimeUpdate}
                />
                <video
                  key={`seek-${playbackSrc}-${reloadToken}`}
                  ref={seekRef}
                  src={playbackSrc}
                  className="pointer-events-none fixed left-[-9999px] top-0 opacity-0"
                  style={{ width: 160, height: 90 }}
                  preload="auto"
                  muted
                  playsInline
                  aria-hidden
                />
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <div className="join">
                  <button
                    type="button"
                    className={`btn btn-sm join-item ${mode === "play" ? "btn-active" : ""}`}
                    onClick={() => {
                      modeRef.current = "play";
                      setMode("play");
                    }}
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm join-item ${mode === "compare" ? "btn-active" : ""}`}
                    onClick={() => beginCompare()}
                  >
                    Compare frames
                  </button>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  title={previewMuted ? "Unmute preview" : "Mute preview"}
                  onClick={() => setPreviewMuted((m) => !m)}
                >
                  {previewMuted ? "🔇" : "🔊"}
                </button>
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs text-base-content/60">match</span>
                  <progress className="progress w-24 h-2" value={matchPct ?? 0} max={100} />
                  <span className={`badge ${scoreColor} badge-sm`}>
                    {matchPct != null ? `${matchPct}%` : "—"}
                  </span>
                </div>
              </div>

              <div
                ref={timelineRef}
                className="shrink-0 cursor-crosshair select-none rounded-lg border border-base-300 bg-base-300/40 p-2 sm:p-3"
                onMouseDown={onTimelineMouseDown}
                role="presentation"
              >
                <div className="flex justify-between text-[11px] text-base-content/50 tabular-nums mb-1">
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
                    <div className="absolute -top-1 -left-1.5 w-3 h-3 rounded-full bg-base-content" />
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
                <span className="tabular-nums text-sm text-base-content/70">
                  {formatLoopTime(playhead)} / {formatLoopTime(duration)}
                </span>
                <span className="text-sm text-base-content/50 ml-auto">
                  loop span:{" "}
                  <strong className="text-base-content">
                    {outPoint > inPoint ? formatLoopTime(outPoint - inPoint) : "—"}
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
                        setInPoint(Math.max(0, Math.min(t, outPoint - MIN_LOOP_SPAN)));
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
                        setOutPoint(Math.max(inPoint + MIN_LOOP_SPAN, Math.min(t, duration)));
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
                  disabled={!imageId || previewOnly || ffmpegAvailable === false}
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
                  <span className="text-xs text-warning self-center">ffmpeg not installed</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <dialog className={`modal ${exportOpen ? "modal-open" : ""}`}>
        <div className="modal-box">
          <h3 className="font-bold text-lg">Export loop</h3>
          <p className="text-sm text-base-content/60 py-2">
            Re-encodes the trim for WebKit <code>video loop</code>. Audio is stripped. Plain trim is
            a hard cut; with midpoint crossfade, FFmpeg splits the span in two and xfades the join
            (output is slightly shorter than the span). Falls back to trim if xfade fails.
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
              onChange={(e) => setPreset(e.target.value as VideoLoopExportRequest["preset"])}
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
                <span className="label-text">Replace gallery file (same id)</span>
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
              {exporting ? <span className="loading loading-spinner loading-sm" /> : "Export"}
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
    </div>
  );
}
