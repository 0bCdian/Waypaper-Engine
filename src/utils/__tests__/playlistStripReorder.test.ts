import { describe, expect, it } from "vitest";
import type { PlaylistImage } from "../../../electron/daemon-go-types";
import {
  reorderPlaylistImagesBySortableMove,
  reorderTimeOfDayPlaylistImages,
  sortTimeOfDayPlaylistImages,
} from "../playlistStripReorder";

function rows(ids: number[]): PlaylistImage[] {
  return ids.map((image_id) => ({ image_id }));
}

describe("reorderPlaylistImagesBySortableMove", () => {
  it("returns null when from equals to", () => {
    const images = rows([1, 2, 3]);
    expect(reorderPlaylistImagesBySortableMove(images, 1, 1)).toBeNull();
  });

  it("returns null when from is out of range", () => {
    const images = rows([1, 2]);
    expect(reorderPlaylistImagesBySortableMove(images, 5, 0)).toBeNull();
    expect(reorderPlaylistImagesBySortableMove(images, -1, 0)).toBeNull();
  });

  it("returns null when to is out of range", () => {
    const images = rows([1, 2]);
    expect(reorderPlaylistImagesBySortableMove(images, 0, 5)).toBeNull();
    expect(reorderPlaylistImagesBySortableMove(images, 0, -1)).toBeNull();
  });

  it("moves first item to end", () => {
    const images = rows([1, 2, 3, 4]);
    const got = reorderPlaylistImagesBySortableMove(images, 0, 3);
    expect(got?.map((r) => r.image_id)).toEqual([2, 3, 4, 1]);
  });

  it("moves last item to front", () => {
    const images = rows([1, 2, 3, 4]);
    const got = reorderPlaylistImagesBySortableMove(images, 3, 0);
    expect(got?.map((r) => r.image_id)).toEqual([4, 1, 2, 3]);
  });

  it("preserves row payloads (e.g. time) when moving", () => {
    const images: PlaylistImage[] = [
      { image_id: 1, time: 100 },
      { image_id: 2, time: 200 },
    ];
    const got = reorderPlaylistImagesBySortableMove(images, 0, 1);
    expect(got).toEqual([
      { image_id: 2, time: 200 },
      { image_id: 1, time: 100 },
    ]);
  });
});

describe("sortTimeOfDayPlaylistImages", () => {
  it("orders by minutes ascending", () => {
    const got = sortTimeOfDayPlaylistImages([
      { image_id: 1, time: 900 },
      { image_id: 2, time: 400 },
      { image_id: 3, time: 1200 },
    ]);
    expect(got.map((i) => i.image_id)).toEqual([2, 1, 3]);
  });
});

describe("reorderTimeOfDayPlaylistImages", () => {
  it("returns null on invalid indices", () => {
    const images: PlaylistImage[] = [
      { image_id: 1, time: 480 },
      { image_id: 2, time: 1200 },
    ];
    expect(reorderTimeOfDayPlaylistImages(images, 1, 1)).toBeNull();
    expect(reorderTimeOfDayPlaylistImages(images, 5, 0)).toBeNull();
    expect(reorderTimeOfDayPlaylistImages(images, 0, -1)).toBeNull();
  });

  it("swaps the times of two cards when one is dragged past the other", () => {
    const images: PlaylistImage[] = [
      { image_id: 1, time: 480 }, // 08:00
      { image_id: 2, time: 1200 }, // 20:00
    ];
    // Drag card 2 (index 1) to the front (index 0).
    const got = reorderTimeOfDayPlaylistImages(images, 1, 0);
    expect(got).toEqual([
      { image_id: 2, time: 480 },
      { image_id: 1, time: 1200 },
    ]);
  });

  it("keeps the time column chronological as images move across slots", () => {
    const images: PlaylistImage[] = [
      { image_id: 1, time: 300 },
      { image_id: 2, time: 600 },
      { image_id: 3, time: 900 },
    ];
    // Drag the first card to the end.
    const got = reorderTimeOfDayPlaylistImages(images, 0, 2);
    expect(got?.map((r) => r.image_id)).toEqual([2, 3, 1]);
    expect(got?.map((r) => r.time)).toEqual([300, 600, 900]);
  });

  it("does not mutate the input array", () => {
    const images: PlaylistImage[] = [
      { image_id: 1, time: 480 },
      { image_id: 2, time: 1200 },
    ];
    reorderTimeOfDayPlaylistImages(images, 1, 0);
    expect(images.map((r) => r.image_id)).toEqual([1, 2]);
    expect(images[0].time).toBe(480);
  });
});
