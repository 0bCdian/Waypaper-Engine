import { useEffect } from "react";
import { useHistoryStore } from "../stores/historyStore";
import { useContextMenuStore } from "../stores/contextMenuStore";
import { useShallow } from "zustand/react/shallow";
import { useMonitorStore } from "../stores/monitors";
import { buildHistoryEntryMenuItems } from "../utils/historyContextMenuItems";
import { confirmDialog } from "../components/ConfirmDialog";
import type { ImageHistoryEntry, Image } from "../../electron/daemon-go-types";
import { notifyWallpaperApplyFailed } from "../utils/daemonUserFacingError";
import { getThumbnailSrc } from "../utils/utilities";

const { goDaemon } = window.API_RENDERER;

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

function sourceLabel(entry: ImageHistoryEntry): string {
  switch (entry.source.type) {
    case "playlist":
      return entry.source.playlist_name ? `Playlist: ${entry.source.playlist_name}` : "Playlist";
    case "random":
      return "Random";
    case "history":
      return "History replay";
    case "restore":
      return "Restored";
    default:
      return "Manual";
  }
}

function modeBadge(mode: string): string {
  switch (mode) {
    case "clone":
      return "Clone";
    case "extend":
      return "Extend";
    default:
      return "Individual";
  }
}

function EntryThumbnail({ image }: { image: Image | undefined }) {
  if (!image) {
    return (
      <div className="w-16 h-12 rounded bg-base-300 flex items-center justify-center shrink-0">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="opacity-40"
        >
          <title>No image</title>
          <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
        </svg>
      </div>
    );
  }

  const src = getThumbnailSrc(image);
  return (
    <img
      src={src}
      alt={image.name}
      className="w-16 h-12 rounded object-cover shrink-0"
      loading="lazy"
      draggable={false}
    />
  );
}

function HistoryEntry({
  entry,
  image,
  onContextMenu,
}: {
  entry: ImageHistoryEntry;
  image: Image | undefined;
  onContextMenu: (e: React.MouseEvent, entry: ImageHistoryEntry) => void;
}) {
  const handleClick = () => {
    void goDaemon
      .setWallpaper(entry.image_id, undefined, entry.mode, entry.monitors)
      .catch(notifyWallpaperApplyFailed);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onContextMenu={(e) => onContextMenu(e, entry)}
      className="flex items-center gap-4 p-3 rounded-lg hover:bg-base-200 transition-colors cursor-pointer w-full text-left group"
    >
      <EntryThumbnail image={image} />
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate text-base-content">{entry.image_name}</p>
        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-base-content/60">
          <span className="badge badge-xs badge-ghost">{modeBadge(entry.mode)}</span>
          <span className="badge badge-xs badge-ghost">{sourceLabel(entry)}</span>
          {entry.monitors.map((m) => (
            <span key={m} className="badge badge-xs badge-outline">
              {m}
            </span>
          ))}
        </div>
      </div>
      <span className="text-xs text-base-content/40 shrink-0">
        {formatRelativeTime(entry.set_at)}
      </span>
    </button>
  );
}

const History = () => {
  const { entries, imageCache, isLoading, hasMore, fetchHistory, loadMore, clearHistory } =
    useHistoryStore(
      useShallow((s) => ({
        entries: s.entries,
        imageCache: s.imageCache,
        isLoading: s.isLoading,
        hasMore: s.hasMore,
        fetchHistory: s.fetchHistory,
        loadMore: s.loadMore,
        clearHistory: s.clearHistory,
      })),
    );
  const monitors = useMonitorStore((s) => s.monitorsList);
  const openContextMenu = useContextMenuStore((s) => s.open);

  useEffect(() => {
    fetchHistory();

    const disposers = [
      goDaemon.on("history_cleared", () => {
        useHistoryStore.getState().reset();
      }),
      goDaemon.on("wallpaper_changed", () => {
        useHistoryStore.getState().fetchHistory();
      }),
    ];

    return () => {
      for (const dispose of disposers) dispose();
    };
  }, [fetchHistory]);

  const handleContextMenu = (e: React.MouseEvent, entry: ImageHistoryEntry) => {
    const items = buildHistoryEntryMenuItems(entry, monitors);
    openContextMenu(e, items);
  };

  const handleClear = async () => {
    const confirmed = await confirmDialog({
      title: "Clear wallpaper history",
      message: "Are you sure you want to delete all wallpaper history? This cannot be undone.",
      confirmLabel: "Clear all",
      danger: true,
    });
    if (confirmed) void clearHistory();
  };

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-base-content">Wallpaper History</h2>
          <p className="text-sm text-base-content/60">
            {entries.length > 0 ? `${entries.length} entries` : "No history yet"}
          </p>
        </div>
        {entries.length > 0 && (
          <button type="button" onClick={handleClear} className="btn btn-error btn-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <title>Clear</title>
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              <line x1="10" x2="10" y1="11" y2="17" />
              <line x1="14" x2="14" y1="11" y2="17" />
            </svg>
            Clear all
          </button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && entries.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <span className="loading loading-spinner loading-md" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-base-content/40 gap-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <title>No history</title>
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <p className="text-sm">No wallpaper changes recorded yet</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-base-200">
            {entries.map((entry) => (
              <HistoryEntry
                key={entry.id}
                entry={entry}
                image={imageCache.get(entry.image_id)}
                onContextMenu={handleContextMenu}
              />
            ))}
            {hasMore && (
              <div className="py-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  disabled={isLoading}
                  className="btn btn-ghost btn-sm"
                >
                  {isLoading ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : (
                    "Load more"
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default History;
