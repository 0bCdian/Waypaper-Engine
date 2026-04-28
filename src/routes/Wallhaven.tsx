import { useCallback, useEffect, useRef, useState } from "react";
import { useSettingsModalStore } from "@/stores/settingsModalStore";
import { useShallow } from "zustand/react/shallow";
import {
  useWallhavenStore,
  type WallhavenCategory,
  type WallhavenPurity,
  type WallhavenSorting,
  type WallhavenScrollMode,
  type WallhavenWallpaper,
} from "../stores/wallhavenStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useIsNeo } from "../hooks/useIsNeo";
import { useContextMenuStore } from "../stores/contextMenuStore";
import { useMonitorStore } from "../stores/monitors";
import {
  buildWallhavenCardMenuItems,
  buildWallhavenPageMenuItems,
} from "../utils/wallhavenContextMenuItems";
import { cn } from "../utils/cn";

const SORTING_OPTIONS: { value: WallhavenSorting; label: string }[] = [
  { value: "date_added", label: "Date Added" },
  { value: "relevance", label: "Relevance" },
  { value: "random", label: "Random" },
  { value: "views", label: "Views" },
  { value: "favorites", label: "Favorites" },
  { value: "toplist", label: "Top List" },
];

function WallhavenPage() {
  const config = useSettingsStore((s) => s.config);
  const isNeo = useIsNeo();

  const {
    filters,
    results,
    meta,
    isLoading,
    error,
    downloadingIds,
    scrollMode,
    infiniteResults,
    selectedWallpapers,
    batchDownloadProgress,
    setQuery,
    toggleCategory,
    togglePurity,
    setSorting,
    setPage,
    search,
    loadNextPage,
    selectWallpaper,
    downloadToGallery,
    setScrollMode,
    toggleSelection,
    selectAllVisible,
    clearSelection,
    downloadSelected,
  } = useWallhavenStore(
    useShallow((s) => ({
      filters: s.filters,
      results: s.results,
      meta: s.meta,
      isLoading: s.isLoading,
      error: s.error,
      downloadingIds: s.downloadingIds,
      scrollMode: s.scrollMode,
      infiniteResults: s.infiniteResults,
      selectedWallpapers: s.selectedWallpapers,
      batchDownloadProgress: s.batchDownloadProgress,
      setQuery: s.setQuery,
      toggleCategory: s.toggleCategory,
      togglePurity: s.togglePurity,
      setSorting: s.setSorting,
      setPage: s.setPage,
      search: s.search,
      loadNextPage: s.loadNextPage,
      selectWallpaper: s.selectWallpaper,
      downloadToGallery: s.downloadToGallery,
      setScrollMode: s.setScrollMode,
      toggleSelection: s.toggleSelection,
      selectAllVisible: s.selectAllVisible,
      clearSelection: s.clearSelection,
      downloadSelected: s.downloadSelected,
    })),
  );

  const selectedWallpaper = useWallhavenStore((s) => s.selectedWallpaper);
  const downloadImportAndSet = useWallhavenStore((s) => s.downloadImportAndSet);
  const openMenu = useContextMenuStore((s) => s.open);
  const monitorsList = useMonitorStore((s) => s.monitorsList);
  const monitorSelection = useMonitorStore((s) => s.monitorSelection);

  const apiKey = config?.wallhaven?.api_key ?? "";
  const hasApiKey = apiKey.length > 0;
  const isEnabled = config?.wallhaven?.enabled ?? false;

  const configScrollMode = config?.wallhaven?.scroll_mode;
  useEffect(() => {
    if (configScrollMode && configScrollMode !== scrollMode) {
      setScrollMode(configScrollMode);
    }
  }, [configScrollMode]);

  const [inputValue, setInputValue] = useState(filters.query);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const doSearch = useCallback(
    (page?: number) => {
      if (page !== undefined) setPage(page);
      void search();
    },
    [search, setPage],
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery(inputValue);
    setTimeout(() => doSearch(1), 0);
  };

  useEffect(() => {
    if (isEnabled && results.length === 0 && !isLoading) {
      doSearch();
    }
  }, [isEnabled]);

  useEffect(() => {
    if (scrollMode !== "infinite") return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isLoading) {
          void loadNextPage();
        }
      },
      { root: scrollContainerRef.current, rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [scrollMode, isLoading, loadNextPage]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedWallpaper) {
          selectWallpaper(null);
          return;
        }
        if (selectedWallpapers.size > 0) {
          clearSelection();
          return;
        }
      }

      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "a" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        selectAllVisible();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    selectAllVisible,
    clearSelection,
    selectedWallpaper,
    selectWallpaper,
    selectedWallpapers.size,
  ]);

  const handlePageContextMenu = (e: React.MouseEvent) => {
    openMenu(e, buildWallhavenPageMenuItems(selectedWallpapers.size));
  };

  if (!isEnabled) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-base-content/50">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-16 w-16"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <p className="text-lg font-medium">Wallhaven is disabled</p>
        <p className="text-sm text-center max-w-sm text-base-content/70">
          Enable it in{" "}
          <button
            type="button"
            onClick={() => useSettingsModalStore.getState().openModal("wallhaven")}
            className="link link-primary font-medium"
          >
            Settings → Wallhaven
          </button>{" "}
          to browse wallpapers.
        </p>
      </div>
    );
  }

  const categoryBtn = (cat: WallhavenCategory, label: string) => (
    <button
      type="button"
      className={cn(
        "btn btn-xs",
        filters.categories[cat] ? "btn-primary" : "btn-ghost btn-outline",
      )}
      onClick={() => {
        toggleCategory(cat);
        setTimeout(() => doSearch(1), 0);
      }}
    >
      {label}
    </button>
  );

  const purityBtn = (pur: WallhavenPurity, label: string) => (
    <button
      type="button"
      className={cn(
        "btn btn-xs",
        filters.purity[pur]
          ? pur === "nsfw"
            ? "btn-error"
            : pur === "sketchy"
              ? "btn-warning"
              : "btn-success"
          : "btn-ghost btn-outline",
      )}
      onClick={() => {
        togglePurity(pur);
        setTimeout(() => doSearch(1), 0);
      }}
    >
      {label}
    </button>
  );

  const displayResults = scrollMode === "infinite" ? infiniteResults : results;

  const handleScrollModeToggle = () => {
    const newMode: WallhavenScrollMode = scrollMode === "paginated" ? "infinite" : "paginated";
    setScrollMode(newMode);
    void window.API_RENDERER.goDaemon.updateConfigSection("wallhaven", {
      scroll_mode: newMode,
    });
    if (newMode === "paginated") {
      doSearch(1);
    }
  };

  const hasSelection = selectedWallpapers.size > 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar -- wraps into two rows below lg */}
      <div className="shrink-0 px-3 py-2 border-b border-base-content/10 flex flex-wrap items-center gap-2">
        {/* Row 1: search + sort + scroll mode */}
        <form
          onSubmit={handleSearchSubmit}
          className="flex items-center gap-2 flex-1 min-w-0 basis-full lg:basis-0"
        >
          <input
            ref={searchInputRef}
            type="text"
            className="input input-bordered input-sm flex-1 min-w-0"
            placeholder="Search... (#tag, -#tag)"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          <button type="submit" className="btn btn-sm btn-primary shrink-0">
            Search
          </button>
        </form>

        {/* Row 2 at narrow / same row at wide: category + purity + sort + toggle */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-xs text-base-content/50 hidden lg:inline">Category:</span>
          {categoryBtn("general", "General")}
          {categoryBtn("anime", "Anime")}
          {categoryBtn("people", "People")}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span className="text-xs text-base-content/50 hidden lg:inline">Purity:</span>
          {purityBtn("sfw", "SFW")}
          {purityBtn("sketchy", "Sketchy")}
          {hasApiKey && purityBtn("nsfw", "NSFW")}
        </div>

        <select
          className="select select-bordered select-sm shrink-0"
          value={filters.sorting}
          onChange={(e) => {
            setSorting(e.target.value as WallhavenSorting);
            setTimeout(() => doSearch(1), 0);
          }}
        >
          {SORTING_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <div
          className="tooltip tooltip-bottom shrink-0"
          data-tip={
            scrollMode === "paginated" ? "Switch to infinite scroll" : "Switch to paginated"
          }
        >
          <button
            type="button"
            className={cn(
              "btn btn-xs whitespace-nowrap",
              scrollMode === "infinite" ? "btn-accent" : "btn-ghost btn-outline",
            )}
            onClick={handleScrollModeToggle}
          >
            {scrollMode === "infinite" ? "Infinite" : "Pages"}
          </button>
        </div>
      </div>

      {/* Selection bar - always rendered to avoid layout shift */}
      <div
        className={cn(
          "shrink-0 px-4 py-1.5 border-b flex items-center gap-3 transition-colors duration-150",
          hasSelection ? "bg-primary/10 border-primary/20" : "bg-transparent border-transparent",
        )}
      >
        <span
          className={cn(
            "text-sm font-medium transition-opacity",
            hasSelection ? "opacity-100" : "opacity-0",
          )}
        >
          {selectedWallpapers.size} selected
        </span>
        <button
          type="button"
          className={cn(
            "btn btn-xs btn-primary transition-opacity",
            hasSelection ? "opacity-100" : "opacity-0 pointer-events-none",
          )}
          onClick={() => void downloadSelected()}
          disabled={batchDownloadProgress !== null}
          tabIndex={hasSelection ? 0 : -1}
        >
          {batchDownloadProgress
            ? `Downloading ${batchDownloadProgress.current}/${batchDownloadProgress.total}...`
            : `Download ${selectedWallpapers.size} to Gallery`}
        </button>
        <button
          type="button"
          className={cn(
            "btn btn-xs btn-ghost transition-opacity",
            hasSelection ? "opacity-100" : "opacity-0 pointer-events-none",
          )}
          onClick={clearSelection}
          tabIndex={hasSelection ? 0 : -1}
        >
          Clear
        </button>
      </div>

      {/* Error */}
      {error && <div className="shrink-0 px-4 py-2 bg-error/10 text-error text-sm">{error}</div>}

      {/* Scrollable image grid */}
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4"
        style={{ scrollbarGutter: "stable" }}
        onContextMenu={handlePageContextMenu}
      >
        {isLoading && displayResults.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : displayResults.length === 0 ? (
          <div className="flex items-center justify-center h-full text-base-content/40">
            No results. Try a different search.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-[repeat(auto-fill,minmax(14vw,1fr))] gap-3">
              {displayResults.map((wp) => (
                <WallhavenCard
                  key={wp.id}
                  wp={wp}
                  isNeo={isNeo}
                  isDownloading={downloadingIds.has(wp.id)}
                  isSelected={selectedWallpapers.has(wp.id)}
                  selectedCount={selectedWallpapers.size}
                  monitors={monitorsList}
                  onSelect={() => selectWallpaper(wp)}
                  onDownload={() => void downloadToGallery(wp)}
                  onCtrlClick={() => toggleSelection(wp.id)}
                  onDoubleClick={() => {
                    const monitor =
                      monitorSelection.selectedMonitors.length === 1
                        ? monitorSelection.selectedMonitors[0]
                        : "*";
                    void downloadImportAndSet(wp, monitor, monitorSelection.mode);
                  }}
                />
              ))}
            </div>
            {scrollMode === "infinite" && (
              <div ref={sentinelRef} className="flex justify-center py-4">
                {isLoading && <span className="loading loading-spinner loading-md" />}
              </div>
            )}
          </>
        )}
      </div>

      {/* Pinned pagination (only in paginated mode) */}
      {scrollMode === "paginated" && meta && meta.last_page > 1 && (
        <div className="shrink-0 flex flex-col items-center gap-1 py-2 border-t border-base-content/10">
          <span className="text-xs text-base-content/50">
            Page {meta.current_page} of {meta.last_page} ({meta.total} wallpapers)
          </span>
          <div className="flex items-center gap-2">
            <button
              className="btn btn-sm"
              disabled={filters.page <= 1}
              onClick={() => doSearch(filters.page - 1)}
            >
              Prev
            </button>
            <button
              className="btn btn-sm"
              disabled={filters.page >= meta.last_page}
              onClick={() => doSearch(filters.page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedWallpaper && (
        <WallhavenDetailModal
          wp={selectedWallpaper}
          isNeo={isNeo}
          isDownloading={downloadingIds.has(selectedWallpaper.id)}
          onClose={() => selectWallpaper(null)}
          onDownload={() => void downloadToGallery(selectedWallpaper)}
        />
      )}
    </div>
  );
}

function WallhavenCard({
  wp,
  isNeo,
  isDownloading,
  isSelected,
  selectedCount,
  monitors,
  onSelect,
  onDownload,
  onCtrlClick,
  onDoubleClick,
}: {
  wp: WallhavenWallpaper;
  isNeo: boolean;
  isDownloading: boolean;
  isSelected: boolean;
  selectedCount: number;
  monitors: import("../../electron/daemon-go-types").Monitor[];
  onSelect: () => void;
  onDownload: () => void;
  onCtrlClick: () => void;
  onDoubleClick: () => void;
}) {
  const openMenu = useContextMenuStore((s) => s.open);

  const handleClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      onCtrlClick();
    } else {
      onSelect();
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    openMenu(e, buildWallhavenCardMenuItems(wp, selectedCount, monitors));
  };

  return (
    <div
      className={cn(
        "group relative cursor-pointer bg-base-200 overflow-hidden",
        isNeo
          ? "border-2 border-base-content/80 shadow-[3px_3px_0_0_rgba(0,0,0,0.5)]"
          : "rounded-lg",
        isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-base-100",
      )}
      onContextMenu={handleContextMenu}
      onClick={handleClick}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
    >
      {isSelected && (
        <div className="absolute top-2 left-2 z-10">
          <div className="w-5 h-5 rounded bg-primary flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="white"
              className="w-3.5 h-3.5"
            >
              <path
                fillRule="evenodd"
                d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>
      )}
      <img
        src={wp.thumbs.small}
        alt={`Wallhaven ${wp.id}`}
        className="transform-gpu w-full aspect-[3/2] object-cover transition-transform duration-300 group-hover:scale-105"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 p-2 flex items-end justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-white/80 font-mono">{wp.resolution}</span>
          <div className="flex gap-1">
            <span className="badge badge-xs badge-ghost text-white/70">{wp.category}</span>
            <span className="badge badge-xs badge-ghost text-white/70">{wp.purity}</span>
          </div>
        </div>
        <button
          type="button"
          className={cn("btn btn-xs btn-primary", isDownloading && "btn-disabled")}
          onClick={(e) => {
            e.stopPropagation();
            onDownload();
          }}
        >
          {isDownloading ? <span className="loading loading-spinner loading-xs" /> : "↓"}
        </button>
      </div>
    </div>
  );
}

function WallhavenDetailModal({
  wp,
  isNeo,
  isDownloading,
  onClose,
  onDownload,
}: {
  wp: WallhavenWallpaper;
  isNeo: boolean;
  isDownloading: boolean;
  onClose: () => void;
  onDownload: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label="Close modal"
    >
      <div
        className={cn(
          "bg-base-100 max-w-4xl w-[90vw] max-h-[90vh] flex flex-col overflow-hidden",
          isNeo
            ? "border-3 border-base-content/80 shadow-[6px_6px_0_0_rgba(0,0,0,0.5)]"
            : "rounded-xl shadow-2xl",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 min-h-0 overflow-hidden bg-base-200 flex items-center justify-center">
          <img
            src={wp.thumbs.original || wp.thumbs.large}
            alt={`Wallhaven ${wp.id}`}
            className="max-w-full max-h-[65vh] object-contain"
          />
        </div>
        {/* Footer -- stacks vertically below lg */}
        <div className="shrink-0 p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border-t border-base-content/10">
          <div className="flex flex-col gap-1 min-w-0">
            <span className="font-mono text-sm">
              {wp.resolution} &middot; {(wp.file_size / 1024 / 1024).toFixed(1)} MB &middot;{" "}
              {wp.file_type.split("/")[1]?.toUpperCase()}
            </span>
            <div className="flex flex-wrap gap-1">
              <span className="badge badge-sm">{wp.category}</span>
              <span className="badge badge-sm">{wp.purity}</span>
              <span className="badge badge-sm badge-ghost">{wp.favorites} ♥</span>
              <span className="badge badge-sm badge-ghost">{wp.views} views</span>
            </div>
            {wp.colors && wp.colors.length > 0 && (
              <div className="flex gap-1 mt-1">
                {wp.colors.map((c) => (
                  <div
                    key={c}
                    className="w-4 h-4 rounded-sm border border-base-content/20"
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>
            )}
            {wp.tags && wp.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {wp.tags.slice(0, 10).map((t) => (
                  <span key={t.id} className="badge badge-xs badge-outline">
                    {t.name}
                  </span>
                ))}
                {wp.tags.length > 10 && (
                  <span className="badge badge-xs badge-ghost">+{wp.tags.length - 10}</span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={wp.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm btn-ghost"
            >
              Open on Wallhaven
            </a>
            <button
              type="button"
              className={cn("btn btn-sm btn-primary", isDownloading && "btn-disabled")}
              onClick={onDownload}
            >
              {isDownloading ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                "Download to Gallery"
              )}
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WallhavenPage;
