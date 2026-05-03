import { describe, it, expect, beforeEach, vi } from "vitest";
import { playlistGalleryDragAddsImages } from "../playlistGalleryDrag";
import { usePlaylistStore } from "../../stores/playlist";

vi.mock("../../stores/playlist", () => ({
  usePlaylistStore: {
    getState: vi.fn(),
  },
}));

describe("playlistGalleryDragAddsImages", () => {
  beforeEach(() => {
    vi.mocked(usePlaylistStore.getState).mockReturnValue({
      playlistImagesSet: new Set([1, 2]),
    } as ReturnType<typeof usePlaylistStore.getState>);
  });

  it("is false when every dragged id is already on the playlist", () => {
    expect(playlistGalleryDragAddsImages("image", [1])).toBe(false);
    expect(playlistGalleryDragAddsImages("image", [1, 2])).toBe(false);
  });

  it("is true when any dragged id is not on the playlist", () => {
    expect(playlistGalleryDragAddsImages("image", [3])).toBe(true);
    expect(playlistGalleryDragAddsImages("image", [1, 3])).toBe(true);
  });

  it("is true for folder drags (contents unknown synchronously)", () => {
    expect(playlistGalleryDragAddsImages("folder", [99])).toBe(true);
  });

  it("is false for empty ids or non-gallery types", () => {
    expect(playlistGalleryDragAddsImages("image", [])).toBe(false);
    expect(playlistGalleryDragAddsImages("playlist-item", [1])).toBe(false);
    expect(playlistGalleryDragAddsImages(null, [1])).toBe(false);
  });
});
