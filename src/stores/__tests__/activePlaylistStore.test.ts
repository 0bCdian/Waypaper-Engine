import { vi, describe, it, expect, beforeEach } from "vitest";
import { act } from "@testing-library/react";
import type { ActivePlaylistInstance } from "../../../electron/daemon-go-types";

const STORAGE_KEY = "waypaper-active-playlist";

describe("useActivePlaylistStore", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  async function getStore() {
    const mod = await import("../activePlaylistStore");
    return mod.useActivePlaylistStore;
  }

  const sampleActive: ActivePlaylistInstance = {
    playlist_id: 1,
    playlist_name: "My Playlist",
    current_index: 0,
    current_image_id: 42,
    previous_image_id: null,
    next_image_id: 43,
    total_images: 5,
    paused: false,
    mode: "individual",
    started_at: new Date().toISOString(),
    next_change_at: null,
    monitors: ["HDMI-A-1"],
  };

  it("initial state loads from localStorage", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleActive));

    const useActivePlaylistStore = await getStore();
    const state = useActivePlaylistStore.getState();

    expect(state.activePlaylist).not.toBeNull();
    expect(state.activePlaylist!.playlist_id).toBe(1);
    expect(state.activePlaylist!.playlist_name).toBe("My Playlist");
  });

  it("setActivePlaylist sets and persists", async () => {
    const useActivePlaylistStore = await getStore();

    act(() => {
      useActivePlaylistStore.getState().setActivePlaylist(sampleActive);
    });

    const state = useActivePlaylistStore.getState();
    expect(state.activePlaylist).toEqual(sampleActive);

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(persisted.playlist_id).toBe(1);
  });

  it("clear removes from localStorage and resets state", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleActive));

    const useActivePlaylistStore = await getStore();
    expect(useActivePlaylistStore.getState().activePlaylist).not.toBeNull();

    act(() => {
      useActivePlaylistStore.getState().clear();
    });

    expect(useActivePlaylistStore.getState().activePlaylist).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("handles corrupt localStorage gracefully", async () => {
    localStorage.setItem(STORAGE_KEY, "not valid json {{{");

    const useActivePlaylistStore = await getStore();
    const state = useActivePlaylistStore.getState();

    expect(state.activePlaylist).toBeNull();
  });
});
