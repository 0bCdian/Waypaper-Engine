import { describe, expect, it } from "vitest";
import type { PlaylistImage } from "../../../electron/daemon-go-types";
import {
  reorderPlaylistImagesBySortableMove,
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
