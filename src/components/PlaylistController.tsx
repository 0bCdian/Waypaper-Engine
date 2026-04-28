import { useCallback, useEffect, useRef, useState } from "react";
import { useActivePlaylistStore } from "../stores/activePlaylistStore";
import { useImagesStore } from "../stores/images";
import { useIsNeo } from "../hooks/useIsNeo";
import { cn } from "../utils/cn";
import { getThumbnailSrc } from "../utils/utilities";

const { goDaemon } = window.API_RENDERER;

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/**
 * Progress + clocks for the active slot. Slot bounds live in React state so the
 * first paint after `next_change_at` arrives is correct (module-level cache +
 * useEffect did not re-render this subtree). When playing, a 500ms tick
 * updates elapsed; when paused, the bar stays frozen without a timer.
 */
function TrackProgress({
  paused,
  isNeo,
  slotKey,
  nextChangeAt,
}: {
  paused: boolean;
  isNeo: boolean;
  slotKey: string;
  nextChangeAt: string | null;
}) {
  const prevSlotKeyRef = useRef<string | null>(null);
  const [slot, setSlot] = useState<{ startedAt: number; endsAt: number } | null>(null);

  useEffect(() => {
    if (!slotKey || !nextChangeAt) {
      prevSlotKeyRef.current = null;
      setSlot(null);
      return;
    }
    const endsAt = new Date(nextChangeAt).getTime();
    if (!Number.isFinite(endsAt)) {
      setSlot(null);
      return;
    }

    const keyChanged = prevSlotKeyRef.current !== slotKey;
    prevSlotKeyRef.current = slotKey;

    setSlot((prev) => {
      if (keyChanged || !prev) {
        return { startedAt: Date.now(), endsAt };
      }
      return { ...prev, endsAt };
    });
  }, [slotKey, nextChangeAt]);

  const [, forceTick] = useState(0);
  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => forceTick((n) => n + 1), 500);
    return () => clearInterval(interval);
  }, [paused]);

  let elapsedSec = 0;
  let totalSec = 0;
  let pct = 0;
  if (slot && slot.endsAt > slot.startedAt) {
    totalSec = (slot.endsAt - slot.startedAt) / 1000;
    elapsedSec = Math.min(totalSec, (Date.now() - slot.startedAt) / 1000);
    pct = totalSec > 0 ? Math.min(100, (elapsedSec / totalSec) * 100) : 0;
  }
  const remainingSec = Math.max(0, totalSec - elapsedSec);

  return (
    <div className="flex items-center gap-2">
      <span className="w-9 shrink-0 text-right text-[0.65rem] tabular-nums text-base-content/60">
        {totalSec > 0 ? formatClock(elapsedSec) : "—"}
      </span>
      <div
        className={cn(
          "relative h-1.5 flex-1 overflow-hidden",
          isNeo ? "neo-progress-track" : "rounded-full bg-base-content/10",
        )}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
      >
        <div
          className={cn(
            "absolute inset-y-0 left-0 transition-[width] duration-500 ease-linear",
            isNeo ? "neo-progress-fill" : "rounded-full bg-primary",
            paused && "opacity-60",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-9 shrink-0 text-[0.65rem] tabular-nums text-base-content/60">
        {totalSec > 0 ? `-${formatClock(remainingSec)}` : "—"}
      </span>
    </div>
  );
}

function PlaylistController() {
  const isNeo = useIsNeo();
  const activePlaylist = useActivePlaylistStore((s) => s.activePlaylist);
  const imagesMap = useImagesStore((s) => s.imagesMap);

  const slotKey = activePlaylist
    ? `${activePlaylist.playlist_id}:${activePlaylist.current_image_id}`
    : "";

  const handlePrevious = useCallback(() => {
    if (!activePlaylist) return;
    void goDaemon.previousPlaylistImage(activePlaylist.playlist_id);
  }, [activePlaylist]);

  const handleNext = useCallback(() => {
    if (!activePlaylist) return;
    void goDaemon.nextPlaylistImage(activePlaylist.playlist_id);
  }, [activePlaylist]);

  const handlePauseResume = useCallback(() => {
    if (!activePlaylist) return;
    if (activePlaylist.paused) void goDaemon.resumePlaylist(activePlaylist.playlist_id);
    else void goDaemon.pausePlaylist(activePlaylist.playlist_id);
  }, [activePlaylist]);

  const handleStop = useCallback(() => {
    if (!activePlaylist) return;
    void goDaemon.stopPlaylist(activePlaylist.playlist_id);
  }, [activePlaylist]);

  if (!activePlaylist) return null;

  const currentImage = imagesMap.get(activePlaylist.current_image_id);
  const monitors = activePlaylist.monitors.join(", ");

  const shellClass = cn(
    "flex w-full min-w-0 items-center gap-3 lg:gap-4",
    isNeo
      ? "neo-now-playing px-3 py-2.5"
      : "rounded-xl border border-base-content/10 bg-gradient-to-r from-base-200/80 to-base-100/80 px-3 py-2.5 shadow-sm backdrop-blur-[2px]",
  );

  const titleClass = cn(
    "truncate text-base font-bold leading-tight lg:text-lg",
    isNeo && "font-[family-name:var(--font-display)] uppercase tracking-tight",
  );

  const transportBtn = (extra?: string) =>
    cn("btn btn-ghost btn-square btn-sm", isNeo && "neo-pc-icon-btn", extra);

  const playPauseBtn = cn(
    "btn btn-square btn-md",
    isNeo ? "neo-pc-play-btn" : "btn-primary rounded-full shadow",
  );

  return (
    <div className={shellClass} role="region" aria-label="Active playlist controls">
      {/* LEFT: artwork */}
      {currentImage && (
        <div className={cn("relative shrink-0", isNeo ? "neo-now-playing-art" : "")}>
          <img
            src={getThumbnailSrc(currentImage)}
            alt={currentImage.name}
            className={cn("h-14 w-14 object-cover lg:h-16 lg:w-16", !isNeo && "rounded-lg")}
          />
          {!activePlaylist.paused && (
            <span
              aria-hidden
              className={cn(
                "absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-success",
                "animate-pulse ring-2 ring-base-100",
              )}
            />
          )}
        </div>
      )}

      {/* CENTER: track meta + progress */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className={titleClass} title={activePlaylist.playlist_name}>
            {activePlaylist.playlist_name}
          </span>
          <span
            className={cn(
              "shrink-0 text-[0.65rem] font-semibold uppercase tracking-widest text-base-content/50",
              isNeo && "font-[family-name:var(--font-display)]",
            )}
          >
            {activePlaylist.paused ? "paused" : "now playing"}
          </span>
        </div>

        <div className="flex min-w-0 items-center gap-2 text-xs text-base-content/60">
          <span className="truncate" title={currentImage?.name ?? "Unknown"}>
            {currentImage?.name ?? "Unknown"}
          </span>
          <span className="shrink-0 opacity-50">·</span>
          <span className="shrink-0 tabular-nums">
            {activePlaylist.current_index + 1}/{activePlaylist.total_images}
          </span>
          {monitors && (
            <>
              <span className="shrink-0 opacity-50">·</span>
              <span
                className={cn(
                  "shrink-0 truncate rounded-sm px-1.5 py-px text-[0.65rem] font-semibold uppercase tracking-wide",
                  isNeo ? "neo-monitor-chip" : "bg-base-content/10 text-base-content/70",
                )}
              >
                {monitors}
              </span>
            </>
          )}
        </div>

        <TrackProgress
          paused={activePlaylist.paused}
          isNeo={isNeo}
          slotKey={slotKey}
          nextChangeAt={activePlaylist.next_change_at}
        />
      </div>

      {/* RIGHT: transport */}
      <div className={cn("flex shrink-0 items-center gap-1", isNeo && "neo-pc-controls")}>
        <button type="button" className={transportBtn()} onClick={handlePrevious} title="Previous">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M7.712 4.819A1.5 1.5 0 0110 6.095v2.973l5.712-4.248A1.5 1.5 0 0118 6.095v7.81a1.5 1.5 0 01-2.288 1.276L10 10.933v2.973a1.5 1.5 0 01-2.288 1.276l-5.712-4.249a1.5 1.5 0 010-2.553l5.712-4.561z" />
          </svg>
        </button>

        <button
          type="button"
          className={playPauseBtn}
          onClick={handlePauseResume}
          title={activePlaylist.paused ? "Resume" : "Pause"}
        >
          {activePlaylist.paused ? (
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
            </svg>
          ) : (
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M5.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75A.75.75 0 007.25 3h-1.5zM12.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75a.75.75 0 00-.75-.75h-1.5z" />
            </svg>
          )}
        </button>

        <button type="button" className={transportBtn()} onClick={handleNext} title="Next">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M12.288 4.819A1.5 1.5 0 0010 6.095v2.973L4.288 4.82A1.5 1.5 0 002 6.095v7.81a1.5 1.5 0 002.288 1.276L10 10.933v2.973a1.5 1.5 0 002.288 1.276l5.712-4.249a1.5 1.5 0 000-2.553l-5.712-4.561z" />
          </svg>
        </button>

        <button
          type="button"
          className={transportBtn("text-error")}
          onClick={handleStop}
          title="Stop"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path
              fillRule="evenodd"
              d="M2 4.75A2.75 2.75 0 014.75 2h10.5A2.75 2.75 0 0118 4.75v10.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25V4.75z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default PlaylistController;
