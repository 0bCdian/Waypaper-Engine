import { describe, it, expect, beforeEach } from "vitest";
import { act } from "@testing-library/react";
import { usePlaylistStore } from "../playlist";
import type { PlaylistConfiguration } from "../../../electron/daemon-go-types";

const STORAGE_KEY = "waypaper-playlist";

describe("usePlaylistStore", () => {
  beforeEach(() => {
    localStorage.clear();
    act(() => {
      usePlaylistStore.getState().clearPlaylist();
    });
  });

  it("initial state loads from localStorage or defaults to empty", () => {
    const state = usePlaylistStore.getState();
    expect(state.playlist.images).toEqual([]);
    expect(state.playlist.name).toBe("");
    expect(state.isEmpty).toBe(true);
    expect(state.isDirty).toBe(false);
  });

  it("addImagesToPlaylist adds images with time slots", () => {
    act(() => {
      usePlaylistStore.getState().addImagesToPlaylist([1, 2, 3]);
    });

    const state = usePlaylistStore.getState();
    expect(state.playlist.images).toHaveLength(3);
    expect(state.playlist.images.map((i) => i.image_id)).toEqual([1, 2, 3]);
    expect(state.isEmpty).toBe(false);
    expect(state.isDirty).toBe(true);

    for (const img of state.playlist.images) {
      expect(typeof img.time).toBe("number");
    }

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(persisted.images).toHaveLength(3);
  });

  it("addImagesToPlaylist skips duplicates", () => {
    act(() => {
      usePlaylistStore.getState().addImagesToPlaylist([1, 2]);
    });
    act(() => {
      usePlaylistStore.getState().addImagesToPlaylist([2, 3]);
    });

    const state = usePlaylistStore.getState();
    expect(state.playlist.images).toHaveLength(3);
    const ids = state.playlist.images.map((i) => i.image_id);
    expect(ids).toContain(1);
    expect(ids).toContain(2);
    expect(ids).toContain(3);
  });

  it("setConfiguration updates config and persists", () => {
    const newConfig: PlaylistConfiguration = {
      type: "time_of_day",
      interval: 600,
      order: "random",
      always_start_on_first_image: true,
    };

    act(() => {
      usePlaylistStore.getState().setConfiguration(newConfig);
    });

    const state = usePlaylistStore.getState();
    expect(state.playlist.configuration.type).toBe("time_of_day");
    expect(state.playlist.configuration.order).toBe("random");
    expect(state.isDirty).toBe(true);

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(persisted.configuration.type).toBe("time_of_day");
  });

  it("setName updates name and persists", () => {
    act(() => {
      usePlaylistStore.getState().setName("My Playlist");
    });

    expect(usePlaylistStore.getState().playlist.name).toBe("My Playlist");
    expect(usePlaylistStore.getState().isDirty).toBe(true);

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(persisted.name).toBe("My Playlist");
  });

  it("removeImagesFromPlaylist removes by ID set", () => {
    act(() => {
      usePlaylistStore.getState().addImagesToPlaylist([1, 2, 3, 4]);
    });

    act(() => {
      usePlaylistStore.getState().removeImagesFromPlaylist(new Set([2, 4]));
    });

    const state = usePlaylistStore.getState();
    expect(state.playlist.images).toHaveLength(2);
    const ids = state.playlist.images.map((i) => i.image_id);
    expect(ids).toEqual([1, 3]);
    expect(state.playlistImagesSet.has(2)).toBe(false);
    expect(state.playlistImagesSet.has(4)).toBe(false);
  });

  it("clearPlaylist resets to empty and persists", () => {
    act(() => {
      usePlaylistStore.getState().addImagesToPlaylist([1, 2]);
      usePlaylistStore.getState().setName("Test");
    });
    act(() => {
      usePlaylistStore.getState().clearPlaylist();
    });

    const state = usePlaylistStore.getState();
    expect(state.playlist.images).toHaveLength(0);
    expect(state.playlist.name).toBe("");
    expect(state.isEmpty).toBe(true);
    expect(state.isDirty).toBe(false);
  });

  it("setPlaylist sets full playlist and persists", () => {
    act(() => {
      usePlaylistStore.getState().setPlaylist({
        name: "Loaded Playlist",
        images: [
          { image_id: 10, time: 100 },
          { image_id: 20, time: 200 },
        ],
        configuration: {
          type: "timer",
          interval: 300,
          order: "ordered",
          always_start_on_first_image: false,
        },
      });
    });

    const state = usePlaylistStore.getState();
    expect(state.playlist.name).toBe("Loaded Playlist");
    expect(state.playlist.images).toHaveLength(2);
    expect(state.isEmpty).toBe(false);
    expect(state.isDirty).toBe(false);
    expect(state.playlistImagesSet.has(10)).toBe(true);
    expect(state.playlistImagesSet.has(20)).toBe(true);

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(persisted.name).toBe("Loaded Playlist");
  });

  it("day_of_week limits to 7 images", () => {
    act(() => {
      usePlaylistStore.getState().setConfiguration({
        type: "day_of_week",
        interval: 300,
        order: "ordered",
        always_start_on_first_image: false,
      });
    });

    act(() => {
      usePlaylistStore.getState().addImagesToPlaylist([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });

    expect(usePlaylistStore.getState().playlist.images).toHaveLength(7);
  });

  it("addImagesToPlaylist inserts before index when insertAt is passed", () => {
    act(() => {
      usePlaylistStore.getState().addImagesToPlaylist([1, 2]);
    });
    act(() => {
      usePlaylistStore.getState().addImagesToPlaylist([99], 1);
    });

    const ids = usePlaylistStore.getState().playlist.images.map((i) => i.image_id);
    expect(ids).toEqual([1, 99, 2]);
  });

  it("addImagesToPlaylist clamps insertAt to array bounds", () => {
    act(() => {
      usePlaylistStore.getState().addImagesToPlaylist([1]);
    });
    act(() => {
      usePlaylistStore.getState().addImagesToPlaylist([88], -5);
    });
    act(() => {
      usePlaylistStore.getState().addImagesToPlaylist([99], 999);
    });

    const ids = usePlaylistStore.getState().playlist.images.map((i) => i.image_id);
    expect(ids).toEqual([88, 1, 99]);
  });

  it("addImagesToPlaylist with insertAt sorts time_of_day playlists by time", () => {
    act(() => {
      usePlaylistStore.getState().setPlaylist({
        name: "T",
        images: [
          { image_id: 1, time: 100 },
          { image_id: 2, time: 500 },
        ],
        configuration: {
          type: "time_of_day",
          interval: 300,
          order: "ordered",
          always_start_on_first_image: false,
        },
      });
    });

    act(() => {
      usePlaylistStore.getState().addImagesToPlaylist([3], 1);
    });

    const times = usePlaylistStore.getState().playlist.images.map((i) => i.time);
    expect(times).toEqual(times.toSorted((a, b) => (a ?? 0) - (b ?? 0)));
    expect(usePlaylistStore.getState().playlist.images).toHaveLength(3);
  });

  it("markClean resets isDirty to false", () => {
    act(() => {
      usePlaylistStore.getState().addImagesToPlaylist([1]);
    });
    expect(usePlaylistStore.getState().isDirty).toBe(true);

    act(() => {
      usePlaylistStore.getState().markClean();
    });
    expect(usePlaylistStore.getState().isDirty).toBe(false);
  });
});
