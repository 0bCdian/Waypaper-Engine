import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import type { VideoLoopExportRequest } from "../../electron/daemon-go-types";
import { useFoldersStore } from "@/stores/foldersStore";
import { useImagesStore } from "@/stores/images";
import { useToastStore } from "@/stores/toastStore";
import { loopStudioMediaSrc } from "@/utils/loopStudio/mediaUrl";
import { computeLoopMatchScore } from "@/utils/loopStudio/matchScore";
import { formatLoopTime, formatLoopTimeShort, parseLoopTime } from "@/utils/loopStudio/timeFormat";

const goDaemon = window.API_RENDERER.goDaemon;

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

  const videoRef = useRef<HTMLVideoElement>(null);
  const seekRef = useRef<HTMLVideoElement>(null);
  const canvasPlayRef = useRef<HTMLCanvasElement>(null);
  const canvasCmpRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const captureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outBitmapRef = useRef<ImageBitmap | null>(null);
  const inBitmapRef = useRef<ImageBitmap | null>(null);
  const dragRef = useRef<"in" | "out" | "seek" | null>(null);
  const modeRef = useRef<StudioMode>(mode);
  modeRef.current = mode;

  useEffect(() => {
    const st = location.state as { imageId?: number } | null;
    if (typeof st?.imageId === "number") {
      setImageId(st.imageId);
      setPreviewOnly(false);
    }
  }, [location.state]);

  useEffect(() => {
    if (previewOnly || !imageId) return;
    let cancelled = false;
    void goDaemon
      .getImage(imageId)
      .then((img) => {
        if (cancelled) return;
        if (img.media_type !== "video") {
          addToast("Selected item is not a video", "error");
          setImageId(null);
          setMediaSrc(null);
          return;
        }
        setMediaSrc(loopStudioMediaSrc(img.path));
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

  const tickPlayCanvas = useCallback(() => {
    const v = videoRef.current;
    const c = canvasPlayRef.current;
    if (!v || !c || mode !== "play") return;
    if (v.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      const ctx = c.getContext("2d");
      if (ctx) ctx.drawImage(v, 0, 0, c.width, c.height);
    }
    rafRef.current = requestAnimationFrame(tickPlayCanvas);
  }, [mode]);

  useEffect(() => {
    if (!loaded || mode !== "play") {
      stopRaf();
      return;
    }
    rafRef.current = requestAnimationFrame(tickPlayCanvas);
    return stopRaf;
  }, [loaded, mode, tickPlayCanvas, stopRaf]);

  const scheduleCaptures = useCallback(() => {
    if (captureTimerRef.current) clearTimeout(captureTimerRef.current);
    captureTimerRef.current = setTimeout(() => {
      void captureFrames();
    }, 300);
  }, []);

  const captureAt = useCallback((t: number): Promise<ImageBitmap | null> => {
    const vs = seekRef.current;
    if (!vs) return Promise.resolve(null);
    return new Promise((resolve) => {
      vs.currentTime = t;
      const onSeeked = async () => {
        vs.removeEventListener("seeked", onSeeked);
        try {
          const bmp = await createImageBitmap(vs);
          resolve(bmp);
        } catch {
          resolve(null);
        }
      };
      vs.addEventListener("seeked", onSeeked);
    });
  }, []);

  const renderCompare = useCallback(() => {
    const outB = outBitmapRef.current;
    const inB = inBitmapRef.current;
    const c = canvasCmpRef.current;
    if (!outB || !inB || !c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const w = c.width;
    const h = c.height;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w / 2, h);
    ctx.clip();
    ctx.drawImage(outB, 0, 0, w, h);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.rect(w / 2, 0, w / 2, h);
    ctx.clip();
    ctx.drawImage(inB, 0, 0, w, h);
    ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.stroke();
  }, []);

  const captureFrames = useCallback(async () => {
    if (!duration) return;
    outBitmapRef.current?.close?.();
    inBitmapRef.current?.close?.();
    outBitmapRef.current = null;
    inBitmapRef.current = null;
    const o = await captureAt(outPoint);
    const i = await captureAt(inPoint);
    outBitmapRef.current = o;
    inBitmapRef.current = i;
    if (o && i) {
      const score = computeLoopMatchScore(o, i);
      setMatchPct(Math.round(score * 100));
      if (modeRef.current === "compare") renderCompare();
    } else {
      setMatchPct(null);
    }
  }, [duration, outPoint, inPoint, captureAt, renderCompare]);

  useEffect(() => {
    scheduleCaptures();
    return () => {
      if (captureTimerRef.current) clearTimeout(captureTimerRef.current);
    };
  }, [inPoint, outPoint, duration, scheduleCaptures]);

  useEffect(() => {
    if (mode === "compare") renderCompare();
  }, [mode, renderCompare]);

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
    const cw = v.videoWidth || 1280;
    const ch = v.videoHeight || 720;
    if (canvasPlayRef.current) {
      canvasPlayRef.current.width = cw;
      canvasPlayRef.current.height = ch;
    }
    if (canvasCmpRef.current) {
      canvasCmpRef.current.width = cw;
      canvasCmpRef.current.height = ch;
    }
    void v.play().catch(() => {});
    scheduleCaptures();
  }, [scheduleCaptures]);

  useEffect(() => {
    const vs = seekRef.current;
    if (!vs || !mediaSrc) return;
    vs.src = mediaSrc;
    vs.load();
  }, [mediaSrc, reloadToken]);

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
        setMode((m) => (m === "play" ? "compare" : "play"));
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
  }, [loaded, duration, inPoint, outPoint]);

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

  const runExport = useCallback(async () => {
    if (!imageId) {
      addToast("Choose a gallery video to export", "error");
      return;
    }
    setExporting(true);
    try {
      const body: VideoLoopExportRequest = {
        in_seconds: inPoint,
        out_seconds: outPoint,
        preset,
        action: exportAction,
        folder_id: useFoldersStore.getState().currentFolderId ?? undefined,
      };
      const res = await goDaemon.videoLoopExport(imageId, body);
      addToast(
        exportAction === "replace" ? "Video replaced in gallery" : `Imported new video (id ${res.image_id})`,
        "success",
        4000,
      );
      setExportOpen(false);
      reQueryImages();
      if (exportAction === "import_new") {
        setImageId(res.image_id);
        setPreviewOnly(false);
        setMediaSrc(loopStudioMediaSrc(res.path));
        setLoaded(false);
        setReloadToken((t) => t + 1);
      } else {
        void goDaemon.getImage(imageId).then((img) => {
          setMediaSrc(loopStudioMediaSrc(img.path));
          setLoaded(false);
          setReloadToken((t) => t + 1);
        });
      }
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Export failed", "error");
    } finally {
      setExporting(false);
    }
  }, [imageId, inPoint, outPoint, preset, exportAction, addToast, reQueryImages]);

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
    matchPct == null ? "badge-ghost" : matchPct > 92 ? "badge-success" : matchPct > 80 ? "badge-warning" : "badge-error";

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-2 overflow-hidden px-2 py-2 sm:gap-3 sm:px-4 sm:py-3">
      <header className="shrink-0 space-y-1">
        <h1 className="text-xl font-bold text-base-content sm:text-2xl">Loop Studio</h1>
        <p className="line-clamp-2 text-xs text-base-content/60 sm:line-clamp-none sm:text-sm">
          Find in/out points and match the last frame to the first. Sub-loop preview uses coarse <code>timeupdate</code>{" "}
          jumps; export bakes a seamless file for native <code>video loop</code> playback.
        </p>
      </header>

      <div className="alert alert-info shrink-0 py-1.5 text-xs sm:text-sm">
        <span>
          <strong>Tip:</strong> Space play/pause, <kbd className="kbd kbd-sm">I</kbd> / <kbd className="kbd kbd-sm">O</kbd>{" "}
          set in/out, <kbd className="kbd kbd-sm">C</kbd> compare, arrows step frames. Export requires a gallery video.
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
            <button type="button" className="btn btn-outline btn-sm" onClick={() => void pickFromDisk()}>
              Open file (preview only)
            </button>
            {previewOnly && <span className="badge badge-warning">Preview only — not in gallery</span>}
          </div>

          {!mediaSrc ? (
            <p className="shrink-0 text-sm text-base-content/50">Select a gallery video or open a file for preview.</p>
          ) : (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
              <div className="relative flex min-h-[11rem] w-full flex-1 items-center justify-center overflow-hidden rounded-lg bg-black sm:min-h-[14rem]">
                <canvas
                  ref={canvasPlayRef}
                  className={mode === "play" ? "block max-h-full max-w-full object-contain" : "hidden"}
                  aria-hidden={mode !== "play"}
                />
                <canvas
                  ref={canvasCmpRef}
                  className={mode === "compare" ? "block max-h-full max-w-full object-contain" : "hidden"}
                  aria-hidden={mode !== "compare"}
                />
                <video
                  key={`${mediaSrc}-${reloadToken}`}
                  ref={videoRef}
                  className="hidden"
                  src={mediaSrc}
                  loop={outPoint - inPoint >= duration - FULL_LOOP_EPS}
                  preload="auto"
                  playsInline
                  onLoadedMetadata={onLoadedMetadata}
                  onTimeUpdate={onTimeUpdate}
                />
                <video ref={seekRef} className="hidden" preload="auto" muted playsInline />
                {mode === "compare" && (
                  <div className="pointer-events-none absolute bottom-2 left-0 right-0 flex justify-between px-4 text-xs">
                    <span className="badge badge-warning/80">out frame</span>
                    <span className="badge badge-success/80">in frame</span>
                  </div>
                )}
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <div className="join">
                  <button
                    type="button"
                    className={`btn btn-sm join-item ${mode === "play" ? "btn-active" : ""}`}
                    onClick={() => setMode("play")}
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm join-item ${mode === "compare" ? "btn-active" : ""}`}
                    onClick={() => setMode("compare")}
                  >
                    Compare frames
                  </button>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs text-base-content/60">match</span>
                  <progress
                    className="progress w-24 h-2"
                    value={matchPct ?? 0}
                    max={100}
                  />
                  <span className={`badge ${scoreColor} badge-sm`}>{matchPct != null ? `${matchPct}%` : "—"}</span>
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
                    style={{ left: `${pct(inPoint)}%`, width: `${pct(outPoint) - pct(inPoint)}%` }}
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
                          e instanceof Error ? e.message : "Playback failed (no valid video source?)";
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
                      if (!Number.isNaN(t)) setInPoint(Math.max(0, Math.min(t, outPoint - MIN_LOOP_SPAN)));
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
                      if (!Number.isNaN(t)) setOutPoint(Math.max(inPoint + MIN_LOOP_SPAN, Math.min(t, duration)));
                    }}
                  />
                </label>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={!imageId || previewOnly}
                  onClick={() => setExportOpen(true)}
                >
                  Export with FFmpeg…
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <dialog className={`modal ${exportOpen ? "modal-open" : ""}`}>
        <div className="modal-box">
          <h3 className="font-bold text-lg">Export loop</h3>
          <p className="text-sm text-base-content/60 py-2">
            Re-encodes the trim for WebKit <code>video loop</code>. Audio is stripped.
          </p>
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
            <button type="button" className="btn" onClick={() => setExportOpen(false)} disabled={exporting}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" disabled={exporting} onClick={() => void runExport()}>
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
