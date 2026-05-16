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
import { useContextMenuStore } from "../stores/contextMenuStore";
import { useMonitorStore } from "../stores/monitors";
import {
  buildWallhavenCardMenuItems,
  buildWallhavenPageMenuItems,
} from "../utils/wallhavenContextMenuItems";
import { cn } from "../utils/cn";
import { daemonClient } from "@/client";

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
  const [showBackToTop, setShowBackToTop] = useState(false);
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

  // Back-to-top visibility tracking for infinite scroll mode
  useEffect(() => {
    if (scrollMode !== "infinite") {
      setShowBackToTop(false);
      return;
    }
    const el = scrollContainerRef.current;
    if (!el) return;
    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        setShowBackToTop(el.scrollTop > el.clientHeight);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [scrollMode]);

  const handlePageContextMenu = (e: React.MouseEvent) => {
    openMenu(e, buildWallhavenPageMenuItems(selectedWallpapers.size));
  };

  if (!isEnabled) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="size-12"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          style={{ color: "var(--wp-text-faint)" }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <h3 className="text-base font-semibold">Wallhaven is disabled</h3>
        <p className="text-sm max-w-md" style={{ color: "var(--wp-text-muted)" }}>
          Enable it in Settings → Wallhaven to browse wallpapers.
        </p>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => useSettingsModalStore.getState().openModal("wallhaven")}
        >
          Open Wallhaven settings
        </button>
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
    void daemonClient.updateConfigSection("wallhaven", {
      scroll_mode: newMode,
    });
    if (newMode === "paginated") {
      doSearch(1);
    }
  };

  const hasSelection = selectedWallpapers.size > 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar — two fixed rows */}
      <div
        className="shrink-0 border-b flex flex-col gap-0"
        style={{ borderColor: "var(--wp-hairline)" }}
      >
        {/* Row A: search + scroll-mode toggle */}
        <div className="px-3 py-2 flex items-center gap-2">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 min-w-0">
            <input
              ref={searchInputRef}
              type="text"
              className="input input-bordered input-md flex-1 min-w-0"
              placeholder="Search Wallhaven… (#tag, -#tag)"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
            <button type="submit" className="btn btn-md btn-primary shrink-0">
              Search
            </button>
          </form>
          {/* Scroll-mode two-segment toggle */}
          <div className="flex shrink-0 rounded-[var(--wp-radius-sm)] border border-base-300 overflow-hidden">
            <button
              type="button"
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors",
                scrollMode === "paginated"
                  ? "bg-primary text-primary-content"
                  : "bg-base-100 hover:bg-base-200",
              )}
              onClick={() => scrollMode !== "paginated" && handleScrollModeToggle()}
            >
              Pages
            </button>
            <button
              type="button"
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors border-l border-base-300",
                scrollMode === "infinite"
                  ? "bg-primary text-primary-content"
                  : "bg-base-100 hover:bg-base-200",
              )}
              onClick={() => scrollMode !== "infinite" && handleScrollModeToggle()}
            >
              Infinite
            </button>
          </div>
        </div>

        {/* Row B: filter groups with hairline separators */}
        <div
          className="px-3 py-1.5 flex items-center gap-0 border-t"
          style={{ borderColor: "var(--wp-hairline)" }}
        >
          {/* Category group */}
          <div className="flex items-center gap-1.5 pr-3 wp-toolbar-group">
            <span
              className="text-xs font-medium shrink-0"
              style={{ color: "var(--wp-text-faint)" }}
            >
              Category
            </span>
            {categoryBtn("general", "General")}
            {categoryBtn("anime", "Anime")}
            {categoryBtn("people", "People")}
          </div>

          {/* Vertical hairline */}
          <div
            className="wp-toolbar-hairline self-stretch w-px mx-1 shrink-0"
            style={{ background: "var(--wp-hairline)" }}
          />

          {/* Purity group */}
          <div className="flex items-center gap-1.5 px-3 wp-toolbar-group">
            <span
              className="text-xs font-medium shrink-0"
              style={{ color: "var(--wp-text-faint)" }}
            >
              Purity
            </span>
            {purityBtn("sfw", "SFW")}
            {purityBtn("sketchy", "Sketchy")}
            {hasApiKey && purityBtn("nsfw", "NSFW")}
          </div>

          {/* Vertical hairline */}
          <div
            className="wp-toolbar-hairline self-stretch w-px mx-1 shrink-0"
            style={{ background: "var(--wp-hairline)" }}
          />

          {/* Sort group */}
          <div className="flex items-center gap-1.5 pl-3 wp-toolbar-group">
            <span
              className="text-xs font-medium shrink-0"
              style={{ color: "var(--wp-text-faint)" }}
            >
              Sort
            </span>
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
          </div>
        </div>
      </div>

      {/* Selection bar — always reserved height, hint when empty */}
      <div
        className={cn(
          "shrink-0 px-4 py-2 border-b flex items-center gap-3 transition-colors duration-150",
          hasSelection ? "border-l-4 border-primary" : "border-l-4 border-transparent",
        )}
        style={
          hasSelection
            ? { background: "var(--wp-surface-2)", borderBottomColor: "var(--wp-hairline)" }
            : { background: "transparent", borderBottomColor: "transparent" }
        }
      >
        {hasSelection ? (
          <>
            <span className="text-sm font-medium">
              <strong>{selectedWallpapers.size}</strong> selected
            </span>
            <button
              type="button"
              className="btn btn-xs btn-primary"
              onClick={() => void downloadSelected()}
              disabled={batchDownloadProgress !== null}
            >
              {batchDownloadProgress
                ? `Downloading ${batchDownloadProgress.current}/${batchDownloadProgress.total}...`
                : `Download ${selectedWallpapers.size} to Gallery`}
            </button>
            <button type="button" className="btn btn-xs btn-ghost" onClick={clearSelection}>
              Clear
            </button>
          </>
        ) : (
          <span className="text-xs" style={{ color: "var(--wp-text-faint)" }}>
            Ctrl-click a wallpaper to start a selection, or Ctrl-A to select all.
          </span>
        )}
      </div>

      {/* Error banner (non-fatal, inline) */}
      {error && !isLoading && displayResults.length === 0 && (
        <div className="shrink-0 px-4 py-2 bg-error/10 text-error text-sm hidden">
          {/* Handled by full-page error state below */}
        </div>
      )}

      {/* Scrollable image grid */}
      <div
        ref={scrollContainerRef}
        className="relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4"
        style={{ scrollbarGutter: "stable" }}
        onContextMenu={handlePageContextMenu}
      >
        {isLoading && displayResults.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : error && displayResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="size-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              style={{ color: "var(--wp-text-faint)" }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
            <h3 className="text-base font-semibold">Couldn&apos;t reach Wallhaven</h3>
            <p className="text-sm max-w-md" style={{ color: "var(--wp-text-muted)" }}>
              {error}
            </p>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => doSearch()}>
              Retry
            </button>
          </div>
        ) : displayResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="size-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              style={{ color: "var(--wp-text-faint)" }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0016.803 15.803z"
              />
            </svg>
            <h3 className="text-base font-semibold">No wallpapers found</h3>
            <p className="text-sm max-w-md" style={{ color: "var(--wp-text-muted)" }}>
              Try a different search term or relax the category/purity filters.
            </p>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                // Reset categories/purity/sort to defaults; preserve query per spec
                const cats = filters.categories;
                if (!cats.general) toggleCategory("general");
                if (!cats.anime) toggleCategory("anime");
                if (!cats.people) toggleCategory("people");
                const pur = filters.purity;
                if (!pur.sfw) togglePurity("sfw");
                if (pur.sketchy) togglePurity("sketchy");
                if (pur.nsfw) togglePurity("nsfw");
                setSorting("date_added");
                setTimeout(() => doSearch(1), 0);
              }}
            >
              Reset filters
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-[repeat(auto-fill,minmax(14vw,1fr))] gap-3">
              {displayResults.map((wp) => (
                <WallhavenCard
                  key={wp.id}
                  wp={wp}
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

        {/* Back-to-top button — only in infinite mode after scrolling past viewport height */}
        {showBackToTop && scrollMode === "infinite" && (
          <button
            type="button"
            aria-label="Back to top"
            className="absolute right-4 bottom-4 flex items-center justify-center size-10 rounded-full bg-base-200 border border-base-300 shadow-[var(--wp-elev-2)] transition-opacity hover:bg-base-300"
            onClick={() => {
              scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="size-5"
            >
              <path
                fillRule="evenodd"
                d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Pinned pagination (only in paginated mode) */}
      {scrollMode === "paginated" && meta && meta.last_page > 1 && (
        <div
          className="shrink-0 flex flex-col items-center gap-1 py-2 border-t"
          style={{ borderColor: "var(--wp-hairline)" }}
        >
          <span className="text-xs" style={{ color: "var(--wp-text-faint)" }}>
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

  const selectOnClick = (e: React.MouseEvent) => {
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
        "group relative cursor-pointer flex flex-col bg-base-200 overflow-hidden rounded-[var(--wp-radius-sm)] border-[var(--wp-border-w)] border-[var(--wp-border-color)] shadow-[var(--wp-elev-1,none)]",
        isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-base-100",
      )}
      onContextMenu={handleContextMenu}
      onClick={selectOnClick}
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
          <div className="size-5 rounded bg-primary flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="white"
              className="size-3.5"
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
      {/* Image fills card (flex-1 so footer stays pinned) */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        <img
          src={wp.thumbs.small}
          alt={`Wallhaven ${wp.id}`}
          className="transform-gpu w-full h-full aspect-[3/2] object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        {/* Hover overlay: gradient + download button */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 p-2 flex items-end justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-200">
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
      {/* Resting-state footer strip — always visible */}
      <div
        className="shrink-0 px-2 py-1 flex items-center gap-1.5 text-xs"
        style={{ background: "var(--wp-surface-2)", color: "var(--wp-text-muted)" }}
      >
        <span className="font-mono truncate flex-1">{wp.resolution}</span>
        <span className="shrink-0 capitalize">{wp.category}</span>
      </div>
    </div>
  );
}

function WallhavenDetailModal({
  wp,
  isDownloading,
  onClose,
  onDownload,
}: {
  wp: WallhavenWallpaper;
  isDownloading: boolean;
  onClose: () => void;
  onDownload: () => void;
}) {
  const [showAllTags, setShowAllTags] = useState(false);
  const visibleTags = wp.tags ? (showAllTags ? wp.tags : wp.tags.slice(0, 10)) : [];

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
      {/* oxlint-disable-next-line jsx-a11y/no-static-element-interactions,jsx-a11y/click-events-have-key-events -- stopPropagation guard for modal content so backdrop click doesn't trigger */}
      <div
        className="bg-base-100 max-w-4xl w-[90vw] max-h-[90vh] flex flex-col overflow-hidden rounded-[var(--wp-radius-md)] border-[var(--wp-border-w)] border-[var(--wp-border-color)] shadow-[var(--wp-elev-2,none)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 min-h-0 overflow-hidden bg-base-200 flex items-center justify-center">
          <img
            src={wp.thumbs.original || wp.thumbs.large}
            alt={`Wallhaven ${wp.id}`}
            className="max-w-full max-h-[65vh] object-contain"
          />
        </div>

        {/* Footer — 12-col grid at md+, stacks below */}
        <div
          className="shrink-0 p-4 grid grid-cols-1 md:grid-cols-12 gap-4 border-t"
          style={{ borderColor: "var(--wp-hairline)" }}
        >
          {/* Left 8 cols: metadata + colors + tags */}
          <div className="md:col-span-8 flex flex-col gap-2 min-w-0">
            <h3 className="text-base font-semibold truncate">Wallhaven #{wp.id}</h3>

            {/* Metadata definition list */}
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-sm">
              <dt
                className="text-xs uppercase tracking-wide shrink-0"
                style={{ color: "var(--wp-text-faint)" }}
              >
                Resolution
              </dt>
              <dd className="font-mono">{wp.resolution}</dd>

              <dt
                className="text-xs uppercase tracking-wide shrink-0"
                style={{ color: "var(--wp-text-faint)" }}
              >
                Size
              </dt>
              <dd>{(wp.file_size / 1024 / 1024).toFixed(1)} MB</dd>

              <dt
                className="text-xs uppercase tracking-wide shrink-0"
                style={{ color: "var(--wp-text-faint)" }}
              >
                Format
              </dt>
              <dd>{wp.file_type.split("/")[1]?.toUpperCase()}</dd>

              <dt
                className="text-xs uppercase tracking-wide shrink-0"
                style={{ color: "var(--wp-text-faint)" }}
              >
                Category
              </dt>
              <dd className="capitalize">
                {wp.category} · {wp.purity}
              </dd>

              <dt
                className="text-xs uppercase tracking-wide shrink-0"
                style={{ color: "var(--wp-text-faint)" }}
              >
                Favorites
              </dt>
              <dd>{wp.favorites}</dd>

              <dt
                className="text-xs uppercase tracking-wide shrink-0"
                style={{ color: "var(--wp-text-faint)" }}
              >
                Views
              </dt>
              <dd>{wp.views.toLocaleString()}</dd>
            </dl>

            {/* Colors */}
            {wp.colors && wp.colors.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="text-xs uppercase tracking-wide shrink-0"
                  style={{ color: "var(--wp-text-faint)" }}
                >
                  Colors
                </span>
                <div className="flex gap-1.5 flex-wrap">
                  {wp.colors.map((c) => (
                    <div
                      key={c}
                      className="size-6 rounded-sm"
                      style={{
                        backgroundColor: c,
                        border: "1px solid var(--wp-border-color)",
                      }}
                      title={c}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {wp.tags && wp.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 items-center">
                {visibleTags.map((t) => (
                  <span key={t.id} className="badge badge-xs badge-outline">
                    {t.name}
                  </span>
                ))}
                {!showAllTags && wp.tags.length > 10 && (
                  <button
                    type="button"
                    className="badge badge-xs badge-ghost cursor-pointer hover:badge-primary"
                    onClick={() => setShowAllTags(true)}
                  >
                    +{wp.tags.length - 10} more
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right 4 cols: action stack */}
          <div className="md:col-span-4 flex flex-col gap-2 md:items-stretch justify-start">
            <button
              type="button"
              className={cn("btn btn-primary", isDownloading && "btn-disabled")}
              onClick={onDownload}
            >
              {isDownloading ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                "Download to Gallery"
              )}
            </button>
            <a
              href={wp.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm btn-ghost"
            >
              Open on Wallhaven
            </a>
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
