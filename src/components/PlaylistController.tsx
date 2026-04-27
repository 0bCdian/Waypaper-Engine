import { useCallback, useEffect, useState } from "react";
import { useActivePlaylistStore } from "../stores/activePlaylistStore";
import { useImagesStore } from "../stores/images";
import { getThumbnailSrc } from "../utils/utilities";

const { goDaemon } = window.API_RENDERER;

function PlaylistController() {
  const activePlaylist = useActivePlaylistStore((s) => s.activePlaylist);
  const imagesMap = useImagesStore((s) => s.imagesMap);
  const [tickedCountdown, setTickedCountdown] = useState<string | null>(null);

  useEffect(() => {
    if (!activePlaylist?.next_change_at || activePlaylist.paused) {
      setTickedCountdown(null);
      return;
    }

    const nextChangeAt = activePlaylist.next_change_at;

    function tick() {
      const diff = new Date(nextChangeAt).getTime() - Date.now();
      if (diff <= 0) {
        setTickedCountdown(null);
        return;
      }
      const secs = Math.floor(diff / 1000);
      const mins = Math.floor(secs / 60);
      const hrs = Math.floor(mins / 60);
      if (hrs > 0) {
        setTickedCountdown(`${hrs}h ${mins % 60}m`);
      } else if (mins > 0) {
        setTickedCountdown(`${mins}m ${secs % 60}s`);
      } else {
        setTickedCountdown(`${secs}s`);
      }
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activePlaylist?.next_change_at, activePlaylist?.paused]);

  const countdown = tickedCountdown;

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
    if (activePlaylist.paused) {
      void goDaemon.resumePlaylist(activePlaylist.playlist_id);
    } else {
      void goDaemon.pausePlaylist(activePlaylist.playlist_id);
    }
  }, [activePlaylist]);

  const handleStop = useCallback(() => {
    if (!activePlaylist) return;
    void goDaemon.stopPlaylist(activePlaylist.playlist_id);
  }, [activePlaylist]);

  if (!activePlaylist) {
    // Invisible placeholder — same structure as the active state so layout space is preserved.
    return (
      <div className="invisible pointer-events-none flex items-center gap-2 px-2 py-0" aria-hidden>
        <div className="h-10 w-10 rounded shrink-0" />
        <div className="flex min-w-0 flex-col">
          <span className="text-sm">&nbsp;</span>
          <span className="text-xs">&nbsp;</span>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" className="btn btn-ghost btn-xs btn-square" tabIndex={-1}><span className="h-4 w-4" /></button>
          <button type="button" className="btn btn-ghost btn-sm btn-square" tabIndex={-1}><span className="h-5 w-5" /></button>
          <button type="button" className="btn btn-ghost btn-xs btn-square" tabIndex={-1}><span className="h-4 w-4" /></button>
          <button type="button" className="btn btn-ghost btn-xs btn-square" tabIndex={-1}><span className="h-4 w-4" /></button>
        </div>
      </div>
    );
  }

  const currentImage = imagesMap.get(activePlaylist.current_image_id);
  const monitors = activePlaylist.monitors.join(", ");

  return (
    <div className="flex items-center gap-2 px-2 py-0">
      {currentImage && (
        <img
          src={getThumbnailSrc(currentImage)}
          alt={currentImage.name}
          className="h-10 w-10 rounded object-cover shrink-0"
        />
      )}

      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-semibold text-base-content">
          {activePlaylist.playlist_name}
        </span>
        <span className="truncate text-xs text-base-content/60">
          {currentImage?.name ?? "Unknown"} &middot;{" "}
          {activePlaylist.current_index + 1}/{activePlaylist.total_images}
          {monitors ? ` · ${monitors}` : ""}
        </span>
      </div>

      <div className="flex items-center gap-1 mt-5">
        {countdown && (
          <span className="whitespace-nowrap text-xs min-w-2 tabular-nums text-base-content/50">
            {countdown}
          </span>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-xs btn-square"
          onClick={handlePrevious}
          title="Previous"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
          >
            <path d="M7.712 4.819A1.5 1.5 0 0110 6.095v2.973l5.712-4.248A1.5 1.5 0 0118 6.095v7.81a1.5 1.5 0 01-2.288 1.276L10 10.933v2.973a1.5 1.5 0 01-2.288 1.276l-5.712-4.249a1.5 1.5 0 010-2.553l5.712-4.561z" />
          </svg>
        </button>

        <button
          type="button"
          className="btn btn-ghost btn-sm btn-square"
          onClick={handlePauseResume}
          title={activePlaylist.paused ? "Resume" : "Pause"}
        >
          {activePlaylist.paused ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5"
            >
              <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5"
            >
              <path d="M5.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75A.75.75 0 007.25 3h-1.5zM12.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75a.75.75 0 00-.75-.75h-1.5z" />
            </svg>
          )}
        </button>

        <button
          type="button"
          className="btn btn-ghost btn-xs btn-square"
          onClick={handleNext}
          title="Next"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
          >
            <path d="M12.288 4.819A1.5 1.5 0 0010 6.095v2.973L4.288 4.82A1.5 1.5 0 002 6.095v7.81a1.5 1.5 0 002.288 1.276L10 10.933v2.973a1.5 1.5 0 002.288 1.276l5.712-4.249a1.5 1.5 0 000-2.553l-5.712-4.561z" />
          </svg>
        </button>

        <button
          type="button"
          className="btn btn-ghost btn-xs btn-square text-error"
          onClick={handleStop}
          title="Stop"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
          >
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
