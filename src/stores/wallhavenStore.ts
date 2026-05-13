import { create } from "zustand";
import type { MonitorMode } from "../../electron/daemon-go-types";
import { notifyWallpaperApplyFailed } from "../utils/daemonUserFacingError";
import { logger } from "../utils/logger";
import { daemonClient } from "@/client";

export interface WallhavenThumb {
  large: string;
  original: string;
  small: string;
}

export interface WallhavenTag {
  id: number;
  name: string;
  purity: string;
  category?: string;
}

export interface WallhavenWallpaper {
  id: string;
  url: string;
  short_url: string;
  views: number;
  favorites: number;
  source: string;
  purity: string;
  category: string;
  dimension_x: number;
  dimension_y: number;
  resolution: string;
  ratio: string;
  file_size: number;
  file_type: string;
  created_at: string;
  colors: string[];
  path: string;
  thumbs: WallhavenThumb;
  tags?: WallhavenTag[];
}

export interface WallhavenSearchMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface WallhavenSearchResponse {
  data: WallhavenWallpaper[];
  meta: WallhavenSearchMeta;
}

export type WallhavenCategory = "general" | "anime" | "people";
export type WallhavenPurity = "sfw" | "sketchy" | "nsfw";
export type WallhavenSorting =
  | "date_added"
  | "relevance"
  | "random"
  | "views"
  | "favorites"
  | "toplist";

export type WallhavenScrollMode = "paginated" | "infinite";

interface WallhavenFilters {
  query: string;
  categories: Record<WallhavenCategory, boolean>;
  purity: Record<WallhavenPurity, boolean>;
  sorting: WallhavenSorting;
  page: number;
}

interface CacheEntry {
  data: WallhavenWallpaper[];
  meta: WallhavenSearchMeta;
}

function buildCacheKey(filters: WallhavenFilters): string {
  return JSON.stringify({
    q: filters.query,
    c: filters.categories,
    p: filters.purity,
    s: filters.sorting,
  });
}

interface WallhavenState {
  filters: WallhavenFilters;
  results: WallhavenWallpaper[];
  meta: WallhavenSearchMeta | null;
  isLoading: boolean;
  error: string | null;
  selectedWallpaper: WallhavenWallpaper | null;
  downloadingIds: Set<string>;

  pageCache: Map<string, Map<number, CacheEntry>>;
  cacheKey: string;

  scrollMode: WallhavenScrollMode;
  infiniteResults: WallhavenWallpaper[];
  infiniteHighestPage: number;

  selectedWallpapers: Set<string>;

  batchDownloadProgress: { current: number; total: number } | null;
}

interface WallhavenActions {
  setQuery: (query: string) => void;
  toggleCategory: (cat: WallhavenCategory) => void;
  togglePurity: (pur: WallhavenPurity) => void;
  setSorting: (sorting: WallhavenSorting) => void;
  setPage: (page: number) => void;
  search: () => Promise<void>;
  loadNextPage: () => Promise<void>;
  selectWallpaper: (wp: WallhavenWallpaper | null) => void;
  downloadToGallery: (wp: WallhavenWallpaper) => Promise<void>;
  downloadImportAndSet: (
    wp: WallhavenWallpaper,
    monitor: string,
    mode: MonitorMode,
  ) => Promise<void>;
  setScrollMode: (mode: WallhavenScrollMode) => void;

  toggleSelection: (id: string) => void;
  selectAllVisible: () => void;
  clearSelection: () => void;
  downloadSelected: () => Promise<void>;
}

function buildCategoryString(cats: Record<WallhavenCategory, boolean>): string {
  return `${cats.general ? "1" : "0"}${cats.anime ? "1" : "0"}${cats.people ? "1" : "0"}`;
}

function buildPurityString(pur: Record<WallhavenPurity, boolean>): string {
  return `${pur.sfw ? "1" : "0"}${pur.sketchy ? "1" : "0"}${pur.nsfw ? "1" : "0"}`;
}

function preprocessQuery(query: string): string {
  return query.replace(/#(\S+)/g, "+$1");
}

const defaultFilters: WallhavenFilters = {
  query: "",
  categories: { general: true, anime: true, people: true },
  purity: { sfw: true, sketchy: false, nsfw: false },
  sorting: "date_added",
  page: 1,
};

async function fetchWallhavenDetail(wpId: string): Promise<WallhavenWallpaper | null> {
  try {
    const detail = (await window.API_RENDERER.wallhaven.getWallpaper(wpId)) as {
      data: WallhavenWallpaper;
    };
    return detail.data;
  } catch {
    return null;
  }
}

async function patchImageMetadata(
  imageId: number,
  tags: string[],
  colors: string[],
): Promise<void> {
  try {
    const update: { tags?: string[]; colors?: string[] } = {};
    if (tags.length > 0) update.tags = tags;
    if (colors.length > 0) update.colors = colors;
    if (Object.keys(update).length > 0) {
      await daemonClient.updateImage(imageId, update);
    }
  } catch (err) {
    logger.error("Failed to patch image metadata:", err);
  }
}

async function downloadAndImportWallpaper(wp: WallhavenWallpaper): Promise<number> {
  const detail = await fetchWallhavenDetail(wp.id);
  const tags = detail?.tags?.map((t) => t.name) ?? wp.tags?.map((t) => t.name) ?? [];
  const colors = detail?.colors ?? wp.colors ?? [];

  const tmpPath = await window.API_RENDERER.wallhaven.download(wp.path);

  const importResult = await daemonClient.importImages([tmpPath]);
  const batchId =
    importResult && typeof importResult === "object" && "batch_id" in importResult
      ? (importResult as { batch_id: string }).batch_id
      : null;

  if (!batchId) throw new Error("Import did not return a batch_id");

  return new Promise<number>((resolve, reject) => {
    const timeout = setTimeout(() => {
      dispose?.();
      reject(new Error("Timed out waiting for image processing"));
    }, 30000);

    let dispose: (() => void) | null = null;
    dispose = daemonClient.on("image_processed", (data: unknown) => {
      const payload = data as {
        batch_id: string;
        image?: { id: number };
      };
      if (payload.batch_id === batchId && payload.image?.id) {
        clearTimeout(timeout);
        void patchImageMetadata(payload.image.id, tags, colors);
        dispose?.();
        resolve(payload.image.id);
      }
    });
  });
}

const BATCH_CONCURRENCY = 3;

export const useWallhavenStore = create<WallhavenState & WallhavenActions>()((set, get) => ({
  filters: defaultFilters,
  results: [],
  meta: null,
  isLoading: false,
  error: null,
  selectedWallpaper: null,
  downloadingIds: new Set(),

  pageCache: new Map(),
  cacheKey: buildCacheKey(defaultFilters),

  scrollMode: "paginated",
  infiniteResults: [],
  infiniteHighestPage: 0,

  selectedWallpapers: new Set(),

  batchDownloadProgress: null,

  setQuery: (query) =>
    set((s) => {
      const newFilters = { ...s.filters, query, page: 1 };
      return {
        filters: newFilters,
        cacheKey: buildCacheKey(newFilters),
        infiniteResults: [],
        infiniteHighestPage: 0,
        selectedWallpapers: new Set(),
      };
    }),

  toggleCategory: (cat) =>
    set((s) => {
      const newFilters = {
        ...s.filters,
        categories: {
          ...s.filters.categories,
          [cat]: !s.filters.categories[cat],
        },
        page: 1,
      };
      return {
        filters: newFilters,
        cacheKey: buildCacheKey(newFilters),
        infiniteResults: [],
        infiniteHighestPage: 0,
        selectedWallpapers: new Set(),
      };
    }),

  togglePurity: (pur) =>
    set((s) => {
      const newFilters = {
        ...s.filters,
        purity: {
          ...s.filters.purity,
          [pur]: !s.filters.purity[pur],
        },
        page: 1,
      };
      return {
        filters: newFilters,
        cacheKey: buildCacheKey(newFilters),
        infiniteResults: [],
        infiniteHighestPage: 0,
        selectedWallpapers: new Set(),
      };
    }),

  setSorting: (sorting) =>
    set((s) => {
      const newFilters = { ...s.filters, sorting, page: 1 };
      return {
        filters: newFilters,
        cacheKey: buildCacheKey(newFilters),
        infiniteResults: [],
        infiniteHighestPage: 0,
        selectedWallpapers: new Set(),
      };
    }),

  setPage: (page) => set((s) => ({ filters: { ...s.filters, page } })),

  search: async () => {
    const { filters, cacheKey, pageCache } = get();

    const cached = pageCache.get(cacheKey)?.get(filters.page);
    if (cached) {
      set({
        results: cached.data,
        meta: cached.meta,
        isLoading: false,
        error: null,
      });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const params: Record<string, string> = {
        categories: buildCategoryString(filters.categories),
        purity: buildPurityString(filters.purity),
        sorting: filters.sorting,
        page: String(filters.page),
      };
      const processedQuery = preprocessQuery(filters.query);
      if (processedQuery) params.q = processedQuery;

      const raw = (await window.API_RENDERER.wallhaven.search(params)) as WallhavenSearchResponse;

      const newCache = new Map(pageCache);
      if (!newCache.has(cacheKey)) newCache.set(cacheKey, new Map());
      const filterCache = newCache.get(cacheKey);
      if (filterCache) {
        filterCache.set(filters.page, { data: raw.data, meta: raw.meta });
      }

      const scrollMode = get().scrollMode;
      if (scrollMode === "infinite") {
        const existing = get().infiniteResults;
        const existingIds = new Set(existing.map((w) => w.id));
        const newItems = raw.data.filter((w) => !existingIds.has(w.id));
        set({
          results: raw.data,
          meta: raw.meta,
          isLoading: false,
          pageCache: newCache,
          infiniteResults: [...existing, ...newItems],
          infiniteHighestPage: Math.max(get().infiniteHighestPage, filters.page),
        });
      } else {
        set({
          results: raw.data,
          meta: raw.meta,
          isLoading: false,
          pageCache: newCache,
        });
      }
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Search failed",
        isLoading: false,
      });
    }
  },

  loadNextPage: async () => {
    const { meta, isLoading, infiniteHighestPage } = get();
    if (isLoading) return;
    if (meta && infiniteHighestPage >= meta.last_page) return;

    const nextPage = infiniteHighestPage + 1;
    get().setPage(nextPage);
    await get().search();
  },

  selectWallpaper: (wp) => set({ selectedWallpaper: wp }),

  downloadToGallery: async (wp) => {
    const { downloadingIds } = get();
    if (downloadingIds.has(wp.id)) return;

    set({ downloadingIds: new Set([...downloadingIds, wp.id]) });

    try {
      const detail = await fetchWallhavenDetail(wp.id);
      const tags = detail?.tags?.map((t) => t.name) ?? wp.tags?.map((t) => t.name) ?? [];
      const colors = detail?.colors ?? wp.colors ?? [];

      const tmpPath = await window.API_RENDERER.wallhaven.download(wp.path);

      const importResult = await daemonClient.importImages([tmpPath]);
      const batchId =
        importResult && typeof importResult === "object" && "batch_id" in importResult
          ? (importResult as { batch_id: string }).batch_id
          : null;

      if (batchId && (tags.length > 0 || colors.length > 0)) {
        let dispose: (() => void) | null = null;
        dispose = daemonClient.on("image_processed", (data: unknown) => {
          const payload = data as {
            batch_id: string;
            image?: { id: number };
          };
          if (payload.batch_id === batchId && payload.image?.id) {
            void patchImageMetadata(payload.image.id, tags, colors);
            dispose?.();
          }
        });
        setTimeout(() => dispose?.(), 30000);
      }
    } catch (err) {
      logger.error("Wallhaven download failed:", err);
    } finally {
      set((s) => {
        const next = new Set(s.downloadingIds);
        next.delete(wp.id);
        return { downloadingIds: next };
      });
    }
  },

  downloadImportAndSet: async (wp, monitor, mode) => {
    const { downloadingIds } = get();
    if (downloadingIds.has(wp.id)) return;

    set({ downloadingIds: new Set([...downloadingIds, wp.id]) });

    try {
      const imageId = await downloadAndImportWallpaper(wp);
      await daemonClient.setWallpaper(imageId, monitor, mode);
    } catch (err) {
      logger.error("Wallhaven download+set failed:", err);
      notifyWallpaperApplyFailed(err);
    } finally {
      set((s) => {
        const next = new Set(s.downloadingIds);
        next.delete(wp.id);
        return { downloadingIds: next };
      });
    }
  },

  setScrollMode: (mode) =>
    set((s) => ({
      scrollMode: mode,
      infiniteResults: mode === "infinite" ? [...s.results] : [],
      infiniteHighestPage: mode === "infinite" ? s.filters.page : 0,
    })),

  toggleSelection: (id) =>
    set((s) => {
      const next = new Set(s.selectedWallpapers);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedWallpapers: next };
    }),

  selectAllVisible: () =>
    set((s) => {
      const items = s.scrollMode === "infinite" ? s.infiniteResults : s.results;
      return {
        selectedWallpapers: new Set(items.map((w) => w.id)),
      };
    }),

  clearSelection: () => set({ selectedWallpapers: new Set() }),

  downloadSelected: async () => {
    const { selectedWallpapers, results, infiniteResults, scrollMode } = get();
    if (selectedWallpapers.size === 0) return;

    const allWallpapers = scrollMode === "infinite" ? infiniteResults : results;
    const toDownload = allWallpapers.filter((w) => selectedWallpapers.has(w.id));
    if (toDownload.length === 0) return;

    set({
      batchDownloadProgress: {
        current: 0,
        total: toDownload.length,
      },
    });

    let completed = 0;
    const queue = [...toDownload];

    const worker = async () => {
      while (queue.length > 0) {
        const wp = queue.shift();
        if (!wp) break;
        // oxlint-disable-next-line react-doctor/async-await-in-loop -- ordered: bounded concurrency — N workers share the queue; each pulls one item, completes it, then takes the next (rate limit)
        await get().downloadToGallery(wp);
        completed++;
        set({
          batchDownloadProgress: {
            current: completed,
            total: toDownload.length,
          },
        });
      }
    };

    const workers = Array.from({ length: Math.min(BATCH_CONCURRENCY, toDownload.length) }, () =>
      worker(),
    );
    await Promise.all(workers);

    set({
      batchDownloadProgress: null,
      selectedWallpapers: new Set(),
    });
  },
}));
