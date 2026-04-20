import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  GALLERY_FILTER_INPUT_HISTORY_KEY,
  GALLERY_FILTER_INPUT_HISTORY_MAX,
  loadGalleryFilterInputHistory,
  recordGalleryFilterInputHistoryEntry,
  clearGalleryFilterInputHistory,
} from "../galleryFilterInputHistory";

describe("galleryFilterInputHistory", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("records entries MRU-deduped", () => {
    recordGalleryFilterInputHistoryEntry("q:a");
    recordGalleryFilterInputHistoryEntry("q:b");
    recordGalleryFilterInputHistoryEntry("q:a");
    expect(loadGalleryFilterInputHistory()).toEqual(["q:a", "q:b"]);
  });

  it("caps at GALLERY_FILTER_INPUT_HISTORY_MAX", () => {
    for (let i = 0; i < GALLERY_FILTER_INPUT_HISTORY_MAX + 5; i++) {
      recordGalleryFilterInputHistoryEntry(`t:${i}`);
    }
    expect(loadGalleryFilterInputHistory().length).toBe(GALLERY_FILTER_INPUT_HISTORY_MAX);
    expect(loadGalleryFilterInputHistory()[0]).toBe(`t:${GALLERY_FILTER_INPUT_HISTORY_MAX + 4}`);
  });

  it("clearGalleryFilterInputHistory removes key", () => {
    recordGalleryFilterInputHistoryEntry("tag:x");
    clearGalleryFilterInputHistory();
    expect(localStorage.getItem(GALLERY_FILTER_INPUT_HISTORY_KEY)).toBeNull();
    expect(loadGalleryFilterInputHistory()).toEqual([]);
  });

  it("ignores empty and trims", () => {
    recordGalleryFilterInputHistoryEntry("  ");
    recordGalleryFilterInputHistoryEntry("  ok  ");
    expect(loadGalleryFilterInputHistory()).toEqual(["ok"]);
  });
});
