import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSettingsModalStore } from "@/stores/settingsModalStore";
import { useShallow } from "zustand/react/shallow";
import {
  useWallhavenStore,
  type WallhavenCategory,
  type WallhavenPurity,
  type WallhavenSorting,
  type WallhavenScrollMode,
  type WallhavenWallpaper,
  WALLHAVEN_RATIO_GROUPS,
  WALLHAVEN_PALETTE,
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
import { computeResolutionMatch, largestMonitor } from "../utils/wallhavenResolutionMatch";

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
    downloadedIds,
    hideDownloaded,
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
    toggleRatio,
    setColor,
    setHideDownloaded,
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
      downloadedIds: s.downloadedIds,
      hideDownloaded: s.hideDownloaded,
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
      toggleRatio: s.toggleRatio,
      setColor: s.setColor,
      setHideDownloaded: s.setHideDownloaded,
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
  const blurNsfw = config?.wallhaven?.blur_nsfw_thumbnails ?? true;

  const configScrollMode = config?.wallhaven?.scroll_mode;
  useEffect(() => {
    if (configScrollMode && configScrollMode !== scrollMode) {
      setScrollMode(configScrollMode);
    }
  }, [configScrollMode]);

  const [inputValue, setInputValue] = useState(filters.query);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [showColorPopover, setShowColorPopover] = useState(false);
  const colorBtnRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Largest monitor for resolution-match badges
  const largestMon = largestMonitor(monitorsList);

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

  const rawDisplayResults = scrollMode === "infinite" ? infiniteResults : results;
  const displayResults = hideDownloaded
    ? rawDisplayResults.filter((wp) => !downloadedIds.has(wp.id))
    : rawDisplayResults;

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
          {/* Hide-downloaded toggle */}
          <button
            type="button"
            className={cn(
              "btn btn-xs shrink-0",
              hideDownloaded ? "btn-primary" : "btn-ghost btn-outline",
            )}
            onClick={() => setHideDownloaded(!hideDownloaded)}
            title={
              hideDownloaded
                ? "Show already-downloaded wallpapers"
                : "Hide already-downloaded wallpapers"
            }
          >
            {hideDownloaded ? "Show saved" : "Hide saved"}
          </button>
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

          {/* Vertical hairline */}
          <div
            className="wp-toolbar-hairline self-stretch w-px mx-1 shrink-0"
            style={{ background: "var(--wp-hairline)" }}
          />

          {/* Ratio group */}
          <div className="flex items-center gap-1.5 px-3 wp-toolbar-group">
            <span
              className="text-xs font-medium shrink-0"
              style={{ color: "var(--wp-text-faint)" }}
            >
              Ratio
            </span>
            {WALLHAVEN_RATIO_GROUPS.map((group) => (
              <button
                key={group.label}
                type="button"
                className={cn(
                  "btn btn-xs",
                  filters.ratios.includes(group.label) ? "btn-primary" : "btn-ghost btn-outline",
                )}
                onClick={() => {
                  toggleRatio(group.label);
                  setTimeout(() => doSearch(1), 0);
                }}
              >
                {group.label}
              </button>
            ))}
          </div>

          {/* Vertical hairline */}
          <div
            className="wp-toolbar-hairline self-stretch w-px mx-1 shrink-0"
            style={{ background: "var(--wp-hairline)" }}
          />

          {/* Color group */}
          <div className="flex items-center gap-1.5 px-3 wp-toolbar-group relative">
            <span
              className="text-xs font-medium shrink-0"
              style={{ color: "var(--wp-text-faint)" }}
            >
              Color
            </span>
            <button
              ref={colorBtnRef}
              type="button"
              className="btn btn-xs btn-ghost btn-outline flex items-center gap-1.5"
              onClick={() => setShowColorPopover((v) => !v)}
              aria-label="Pick a color filter"
            >
              {filters.color ? (
                <>
                  <span
                    className="size-3.5 rounded-sm border border-base-300 inline-block shrink-0"
                    style={{ backgroundColor: `#${filters.color}` }}
                  />
                  <span
                    className="ml-0.5 cursor-pointer text-error"
                    onClick={(e) => {
                      e.stopPropagation();
                      setColor(null);
                      setTimeout(() => doSearch(1), 0);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.stopPropagation();
                        setColor(null);
                        setTimeout(() => doSearch(1), 0);
                      }
                    }}
                    aria-label="Clear color filter"
                  >
                    ×
                  </span>
                </>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="size-3.5"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M3.75 3A1.75 1.75 0 002 4.75v10.5c0 .966.784 1.75 1.75 1.75h4.836a3 3 0 01-.836-2.083V14.25a3.75 3.75 0 017.5 0v.667A3 3 0 0114.25 17H16.25A1.75 1.75 0 0018 15.25V4.75A1.75 1.75 0 0016.25 3H3.75zm9 3.5a.75.75 0 01.75.75v1.5h1.5a.75.75 0 010 1.5h-1.5v1.5a.75.75 0 01-1.5 0v-1.5h-1.5a.75.75 0 010-1.5h1.5v-1.5a.75.75 0 01.75-.75zM6.5 9.25a.75.75 0 000 1.5h3a.75.75 0 000-1.5h-3z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
            {showColorPopover && (
              <ColorPalettePopover
                activeColor={filters.color}
                anchorRef={colorBtnRef}
                onSelect={(hex) => {
                  setColor(hex);
                  setShowColorPopover(false);
                  setTimeout(() => doSearch(1), 0);
                }}
                onClose={() => setShowColorPopover(false)}
              />
            )}
          </div>
        </div>

        {/* Row A end: hide-downloaded toggle */}
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
                  isDownloaded={downloadedIds.has(wp.id)}
                  isSelected={selectedWallpapers.has(wp.id)}
                  selectedCount={selectedWallpapers.size}
                  monitors={monitorsList}
                  monitorSelection={monitorSelection}
                  largestMonitor={largestMon}
                  blurNsfw={blurNsfw}
                  onSelect={() => selectWallpaper(wp)}
                  onDownload={async () => {
                    const imageId = await downloadToGallery(wp);
                    if (imageId !== null) {
                      useWallhavenStore.getState().addDownloadedId(wp.id);
                    }
                  }}
                  onSet={(monitor, mode) => void downloadImportAndSet(wp, monitor, mode)}
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
          monitors={monitorsList}
          monitorSelection={monitorSelection}
          largestMonitor={largestMon}
          onClose={() => selectWallpaper(null)}
          onDownload={async () => {
            const imageId = await downloadToGallery(selectedWallpaper);
            if (imageId !== null) {
              useWallhavenStore.getState().addDownloadedId(selectedWallpaper.id);
            }
          }}
          onSet={(monitor, mode) => void downloadImportAndSet(selectedWallpaper, monitor, mode)}
          onTagClick={(tagName) => {
            const current = useWallhavenStore.getState().filters.query;
            const token = `#${tagName}`;
            const alreadyPresent = current
              .split(/\s+/)
              .some((t) => t.toLowerCase() === token.toLowerCase());
            if (!alreadyPresent) {
              const newQuery = current.trim() ? `${current.trim()} ${token}` : token;
              setQuery(newQuery);
              setInputValue(newQuery);
            }
            selectWallpaper(null);
            setTimeout(() => doSearch(1), 0);
          }}
        />
      )}
    </div>
  );
}

/** Clamp a popover to stay within the viewport with a safety margin. */
function clampSetPopoverPosition(anchor: DOMRect, popoverW: number, popoverH: number) {
  const margin = 8;
  let left = anchor.right - popoverW;
  let top = anchor.top - popoverH - 4;

  left = Math.max(margin, Math.min(left, window.innerWidth - popoverW - margin));
  if (top < margin) {
    top = anchor.bottom + 4;
  }
  top = Math.max(margin, Math.min(top, window.innerHeight - popoverH - margin));

  return { left, top };
}

/** Inline SVG download icon (lucide-style: tray with arrow down, 14 × 14). */
function DownloadIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 15V3" />
      <path d="m8 11 4 4 4-4" />
      <path d="M3 19h18" />
      <path d="M3 15v4h18v-4" />
    </svg>
  );
}

/** Popover listing Set options (Clone all / Extend all / per-monitor). */
function SetPopover({
  monitors,
  anchorRef,
  onSet,
  onClose,
}: {
  monitors: import("../../electron/daemon-go-types").Monitor[];
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onSet: (monitor: string, mode: import("../../electron/daemon-go-types").MonitorMode) => void;
  onClose: () => void;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const popover = popoverRef.current;
    if (!anchor || !popover) return;
    const anchorRect = anchor.getBoundingClientRect();
    const { offsetWidth: w, offsetHeight: h } = popover;
    setPos(clampSetPopoverPosition(anchorRect, w, h));
  }, [anchorRef]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onPointerDown = (e: PointerEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={popoverRef}
      className="fixed z-[200] min-w-[160px] rounded-[var(--wp-radius-sm)] border border-base-300 bg-base-100 shadow-[var(--wp-elev-2,none)] py-1 text-sm"
      style={pos ? { left: pos.left, top: pos.top } : { opacity: 0, left: -9999, top: -9999 }}
    >
      <button
        type="button"
        className="w-full text-left px-3 py-1.5 hover:bg-base-200 transition-colors"
        onClick={() => {
          onSet("*", "clone");
          onClose();
        }}
      >
        Clone across all
      </button>
      <button
        type="button"
        className="w-full text-left px-3 py-1.5 hover:bg-base-200 transition-colors"
        onClick={() => {
          onSet("*", "extend");
          onClose();
        }}
      >
        Extend across all
      </button>
      {monitors.length > 0 && (
        <div className="my-1 border-t" style={{ borderColor: "var(--wp-hairline)" }} />
      )}
      {monitors.map((m) => (
        <button
          key={m.name}
          type="button"
          className="w-full text-left px-3 py-1.5 hover:bg-base-200 transition-colors"
          onClick={() => {
            onSet(m.name, "individual");
            onClose();
          }}
        >
          On {m.name}
        </button>
      ))}
    </div>,
    document.body,
  );
}

/** Color palette popover for the color filter (feature 5). */
function ColorPalettePopover({
  activeColor,
  anchorRef,
  onSelect,
  onClose,
}: {
  activeColor: string | null;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onSelect: (hex: string) => void;
  onClose: () => void;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const popover = popoverRef.current;
    if (!anchor || !popover) return;
    const anchorRect = anchor.getBoundingClientRect();
    const pw = popover.offsetWidth;
    const ph = popover.offsetHeight;
    const margin = 8;
    let left = anchorRect.left;
    let top = anchorRect.bottom + 4;
    left = Math.max(margin, Math.min(left, window.innerWidth - pw - margin));
    if (top + ph > window.innerHeight - margin) {
      top = anchorRect.top - ph - 4;
    }
    setPos({ left, top });
  }, [anchorRef]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onPointerDown = (e: PointerEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={popoverRef}
      className="fixed z-[200] p-2 rounded-[var(--wp-radius-sm)] border border-base-300 bg-base-100 shadow-[var(--wp-elev-2,none)]"
      style={pos ? { left: pos.left, top: pos.top } : { opacity: 0, left: -9999, top: -9999 }}
    >
      <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(6, 1.5rem)" }}>
        {WALLHAVEN_PALETTE.map((hex) => (
          <button
            key={hex}
            type="button"
            className="size-6 rounded-sm border transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary"
            style={{
              backgroundColor: `#${hex}`,
              borderColor:
                activeColor === hex
                  ? "var(--p, oklch(55.8% 0.288 302.31))"
                  : "var(--wp-border-color)",
              outline:
                activeColor === hex ? "2px solid var(--p, oklch(55.8% 0.288 302.31))" : "none",
              outlineOffset: "1px",
            }}
            onClick={() => onSelect(hex)}
            title={`#${hex}`}
            aria-label={`Select color #${hex}`}
          />
        ))}
      </div>
    </div>,
    document.body,
  );
}

function WallhavenCard({
  wp,
  isDownloading,
  isDownloaded,
  isSelected,
  selectedCount,
  monitors,
  monitorSelection,
  largestMonitor: largestMon,
  blurNsfw,
  onSelect,
  onDownload,
  onSet,
  onCtrlClick,
  onDoubleClick,
}: {
  wp: WallhavenWallpaper;
  isDownloading: boolean;
  isDownloaded: boolean;
  isSelected: boolean;
  selectedCount: number;
  monitors: import("../../electron/daemon-go-types").Monitor[];
  monitorSelection: import("../stores/monitors").MonitorSelection;
  largestMonitor: import("../../electron/daemon-go-types").Monitor | null;
  blurNsfw: boolean;
  onSelect: () => void;
  onDownload: () => void;
  onSet: (monitor: string, mode: import("../../electron/daemon-go-types").MonitorMode) => void;
  onCtrlClick: () => void;
  onDoubleClick: () => void;
}) {
  const openMenu = useContextMenuStore((s) => s.open);
  const setButtonRef = useRef<HTMLButtonElement>(null);
  const [showSetPopover, setShowSetPopover] = useState(false);

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

  const handleSetClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const selectedMonitors = monitorSelection.selectedMonitors;
    if (monitors.length <= 1 || selectedMonitors.length === 1) {
      const monitor = selectedMonitors.length === 1 ? selectedMonitors[0] : "*";
      onSet(monitor ?? "*", monitorSelection.mode);
    } else {
      setShowSetPopover((v) => !v);
    }
  };

  // Resolution match badge — feature 3
  const resMatch = largestMon ? computeResolutionMatch(wp.resolution, largestMon) : null;

  // NSFW blur — feature 7
  const isNsfw = wp.purity === "nsfw";
  const applyBlur = isNsfw && blurNsfw;

  return (
    <div
      className={cn(
        "group relative cursor-pointer flex flex-col bg-base-200 overflow-hidden rounded-[var(--wp-radius-sm)] border-[var(--wp-border-w)] border-[var(--wp-border-color)] shadow-[var(--wp-elev-1,none)]",
        isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-base-100",
        isDownloaded && !isSelected && "opacity-65",
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

      {/* Top-right status chips (NSFW + In Gallery) */}
      <div className="absolute top-2 right-2 z-10 flex flex-col items-end gap-1">
        {isNsfw && <span className="badge badge-xs badge-error">NSFW</span>}
        {isDownloaded && (
          <span className="badge badge-xs badge-success flex items-center gap-0.5">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="size-2.5"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z"
                clipRule="evenodd"
              />
            </svg>
            In gallery
          </span>
        )}
      </div>

      {/* Image fills card (flex-1 so footer stays pinned) */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        <img
          src={wp.thumbs.small}
          alt={`Wallhaven ${wp.id}`}
          className={cn(
            "transform-gpu w-full h-full aspect-[3/2] object-cover transition-all duration-300 group-hover:scale-105",
            applyBlur && "blur-lg group-hover:blur-none focus-within:blur-none",
          )}
          loading="lazy"
          style={applyBlur ? { transition: "transform 300ms, filter 200ms ease-out" } : undefined}
        />
        {/* Hover overlay: gradient + two-button action row */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 p-2 flex items-end justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {/* Bottom-left: meta (resolution + category) in overlay */}
          <span
            className="text-xs text-white/80 font-mono truncate mr-1"
            style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}
          >
            {wp.resolution}
          </span>
          {/* Bottom-right: Set + Download buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              ref={setButtonRef}
              type="button"
              className={cn("btn btn-xs btn-primary", isDownloading && "btn-disabled")}
              onClick={handleSetClick}
              aria-label="Set wallpaper"
            >
              {isDownloading ? <span className="loading loading-spinner loading-xs" /> : "Set"}
            </button>
            <button
              type="button"
              className={cn(
                "btn btn-xs btn-square btn-ghost text-white",
                isDownloading && "btn-disabled",
              )}
              onClick={(e) => {
                e.stopPropagation();
                onDownload();
              }}
              aria-label="Download to gallery"
            >
              {isDownloading ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <DownloadIcon />
              )}
            </button>
          </div>
        </div>
      </div>
      {/* Resting-state footer strip — always visible */}
      <div
        className="shrink-0 px-2 py-1 flex items-center gap-1.5 text-xs"
        style={{ background: "var(--wp-surface-2)", color: "var(--wp-text-muted)" }}
      >
        {/* Resolution-match badge — feature 3 */}
        {resMatch && (
          <span className={cn("badge badge-xs shrink-0", resMatch.badgeClass)}>
            {resMatch.label}
          </span>
        )}
        <span className="font-mono truncate flex-1">{wp.resolution}</span>
        <span className="shrink-0 capitalize">{wp.category}</span>
      </div>
      {showSetPopover && (
        <SetPopover
          monitors={monitors}
          anchorRef={setButtonRef}
          onSet={onSet}
          onClose={() => setShowSetPopover(false)}
        />
      )}
    </div>
  );
}

function WallhavenDetailModal({
  wp,
  isDownloading,
  monitors,
  monitorSelection,
  largestMonitor: largestMon,
  onClose,
  onDownload,
  onSet,
  onTagClick,
}: {
  wp: WallhavenWallpaper;
  isDownloading: boolean;
  monitors: import("../../electron/daemon-go-types").Monitor[];
  monitorSelection: import("../stores/monitors").MonitorSelection;
  largestMonitor: import("../../electron/daemon-go-types").Monitor | null;
  onClose: () => void;
  onDownload: () => void;
  onSet: (monitor: string, mode: import("../../electron/daemon-go-types").MonitorMode) => void;
  onTagClick: (tagName: string) => void;
}) {
  const [showAllTags, setShowAllTags] = useState(false);
  const [showModalSetPopover, setShowModalSetPopover] = useState(false);
  const modalSetButtonRef = useRef<HTMLButtonElement>(null);
  const visibleTags = wp.tags ? (showAllTags ? wp.tags : wp.tags.slice(0, 10)) : [];
  const resMatch = largestMon ? computeResolutionMatch(wp.resolution, largestMon) : null;

  const handleModalSetClick = () => {
    const selectedMonitors = monitorSelection.selectedMonitors;
    if (monitors.length <= 1 || selectedMonitors.length === 1) {
      const monitor = selectedMonitors.length === 1 ? selectedMonitors[0] : "*";
      onSet(monitor ?? "*", monitorSelection.mode);
    } else {
      setShowModalSetPopover((v) => !v);
    }
  };

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
        className="bg-base-100 max-w-7xl w-[96vw] max-h-[94vh] flex flex-col overflow-hidden rounded-[var(--wp-radius-md)] border-[var(--wp-border-w)] border-[var(--wp-border-color)] shadow-[var(--wp-elev-2,none)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 min-h-0 overflow-hidden bg-base-200 flex items-center justify-center">
          <img
            src={wp.path}
            alt={`Wallhaven ${wp.id}`}
            className="size-full object-contain"
            loading="eager"
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
              <dd className="font-mono flex items-center gap-1.5 flex-wrap">
                {wp.resolution}
                {resMatch && (
                  <span className={cn("badge badge-xs", resMatch.badgeClass)}>
                    {resMatch.label}
                  </span>
                )}
              </dd>

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

            {/* Tags — clickable to append #tag to query (feature 2) */}
            {wp.tags && wp.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 items-center">
                {visibleTags.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="badge badge-xs badge-outline cursor-pointer hover:bg-primary/10 hover:border-primary transition-colors"
                    onClick={() => onTagClick(t.name)}
                    title={`Search for #${t.name}`}
                  >
                    {t.name}
                  </button>
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
              ref={modalSetButtonRef}
              type="button"
              className={cn(
                "btn btn-primary",
                (isDownloading || monitors.length === 0) && "btn-disabled",
              )}
              onClick={handleModalSetClick}
              title={monitors.length === 0 ? "No monitors detected" : undefined}
            >
              {isDownloading ? <span className="loading loading-spinner loading-xs" /> : "Set on…"}
            </button>
            <button
              type="button"
              className={cn("btn btn-outline", isDownloading && "btn-disabled")}
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
      {showModalSetPopover && (
        <SetPopover
          monitors={monitors}
          anchorRef={modalSetButtonRef}
          onSet={onSet}
          onClose={() => setShowModalSetPopover(false)}
        />
      )}
    </div>
  );
}

export default WallhavenPage;
