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
    started_at: new Date().toISOString(),
    next_change_at: null,
    slot_started_at: null,
    monitors: ["HDMI-A-1"],
    applied_to: ["HDMI-A-1"],
    extend: false,
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

  describe("lastSyncedPlaylistId", () => {
    // Pins the property that a `useRef` used to give for free: this tracking
    // state must not leak across component mounts (or, here, across test
    // cases). It now lives in the store rather than module scope, so each
    // fresh import (see getStore()/vi.resetModules() in beforeEach) starts
    // from a clean slate — this test asserts that starting point explicitly,
    // and asserts the store's own reset paths (clear(), setLastSyncedPlaylistId)
    // work as the dedupe logic relies on them.

    it("defaults to null on a fresh store instance", async () => {
      const useActivePlaylistStore = await getStore();
      expect(useActivePlaylistStore.getState().lastSyncedPlaylistId).toBeNull();
    });

    it("setLastSyncedPlaylistId updates the tracked id", async () => {
      const useActivePlaylistStore = await getStore();

      act(() => {
        useActivePlaylistStore.getState().setLastSyncedPlaylistId(7);
      });

      expect(useActivePlaylistStore.getState().lastSyncedPlaylistId).toBe(7);
    });

    it("does not leak a value set in a previous test case", async () => {
      // If this test ran after "setLastSyncedPlaylistId updates the tracked
      // id" without a fresh module/store, this would observe 7 instead of
      // null — exactly the module-scoped-`let` failure mode being guarded
      // against.
      const useActivePlaylistStore = await getStore();
      expect(useActivePlaylistStore.getState().lastSyncedPlaylistId).toBeNull();
    });

    it("clear() resets lastSyncedPlaylistId alongside activePlaylist", async () => {
      const useActivePlaylistStore = await getStore();

      act(() => {
        useActivePlaylistStore.getState().setActivePlaylist(sampleActive);
        useActivePlaylistStore.getState().setLastSyncedPlaylistId(sampleActive.playlist_id);
      });
      expect(useActivePlaylistStore.getState().lastSyncedPlaylistId).toBe(sampleActive.playlist_id);

      act(() => {
        useActivePlaylistStore.getState().clear();
      });

      expect(useActivePlaylistStore.getState().activePlaylist).toBeNull();
      expect(useActivePlaylistStore.getState().lastSyncedPlaylistId).toBeNull();
    });
  });
});
