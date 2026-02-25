import { create } from "zustand";
import type { ImageHistoryEntry, Image } from "../../electron/daemon-go-types";
import { logger } from "../utils/logger";

const { goDaemon } = window.API_RENDERER;

const DEFAULT_LIMIT = 50;

interface HistoryState {
  entries: ImageHistoryEntry[];
  imageCache: Map<number, Image>;
  isLoading: boolean;
  hasMore: boolean;

  fetchHistory: (limit?: number) => Promise<void>;
  loadMore: () => Promise<void>;
  clearHistory: () => Promise<void>;
  reset: () => void;
}

async function resolveImages(
  entries: ImageHistoryEntry[],
  existing: Map<number, Image>,
): Promise<Map<number, Image>> {
  const cache = new Map(existing);
  const missing = new Set<number>();
  for (const e of entries) {
    if (!cache.has(e.image_id)) missing.add(e.image_id);
  }
  if (missing.size === 0) return cache;

  const results = await Promise.allSettled(Array.from(missing).map((id) => goDaemon.getImage(id)));
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) {
      cache.set(r.value.id, r.value);
    }
  }
  return cache;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  entries: [],
  imageCache: new Map(),
  isLoading: false,
  hasMore: true,

  fetchHistory: async (limit = DEFAULT_LIMIT) => {
    set({ isLoading: true });
    try {
      const entries = await goDaemon.getImageHistory(limit);
      const imageCache = await resolveImages(entries, new Map());
      set({
        entries,
        imageCache,
        hasMore: entries.length >= limit,
      });
    } catch (err) {
      logger.error("Failed to fetch history:", err);
    } finally {
      set({ isLoading: false });
    }
  },

  loadMore: async () => {
    const { entries, imageCache, isLoading } = get();
    if (isLoading || entries.length === 0) return;

    const oldest = entries[entries.length - 1];
    set({ isLoading: true });
    try {
      const all = await goDaemon.getImageHistory(DEFAULT_LIMIT + entries.length);
      const newer = all.filter((e) => e.id < oldest.id).slice(0, DEFAULT_LIMIT);
      const merged = [...entries, ...newer];
      const updatedCache = await resolveImages(newer, imageCache);
      set({
        entries: merged,
        imageCache: updatedCache,
        hasMore: newer.length >= DEFAULT_LIMIT,
      });
    } catch (err) {
      logger.error("Failed to load more history:", err);
    } finally {
      set({ isLoading: false });
    }
  },

  clearHistory: async () => {
    try {
      await goDaemon.clearImageHistory();
      set({ entries: [], imageCache: new Map(), hasMore: false });
    } catch (err) {
      logger.error("Failed to clear history:", err);
    }
  },

  reset: () => {
    set({ entries: [], imageCache: new Map(), isLoading: false, hasMore: true });
  },
}));
