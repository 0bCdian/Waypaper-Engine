import { describe, expect, it } from "vitest";
import type { ActivePlaylistInstance } from "../../../electron/daemon-go-types";
import { shouldSkipPlaylistStartAfterUpdate } from "../skipStartAfterPlaylistSave";

const baseActive = (over: Partial<ActivePlaylistInstance>): ActivePlaylistInstance => ({
  playlist_id: 1,
  playlist_name: "P",
  current_index: 0,
  current_image_id: 10,
  previous_image_id: null,
  next_image_id: null,
  total_images: 3,
  paused: false,
  started_at: new Date().toISOString(),
  next_change_at: null,
  slot_started_at: null,
  monitors: ["DP-1"],
  applied_to: ["DP-1"],
  extend: false,
  ...over,
});

describe("shouldSkipPlaylistStartAfterUpdate", () => {
  it("returns true when active matches monitors (any playlist type) after daemon reconcile", () => {
    expect(
      shouldSkipPlaylistStartAfterUpdate({
        savedId: 1,
        playlistType: "manual",
        activePlaylists: [baseActive({})],
        selectedMonitors: ["DP-1"],
        extend: false,
      }),
    ).toBe(true);
  });

  it("returns true for time_of_day with same monitors", () => {
    expect(
      shouldSkipPlaylistStartAfterUpdate({
        savedId: 1,
        playlistType: "time_of_day",
        activePlaylists: [baseActive({})],
        selectedMonitors: ["DP-1"],
        extend: false,
      }),
    ).toBe(true);
  });

  it("returns false when no active row for saved id", () => {
    expect(
      shouldSkipPlaylistStartAfterUpdate({
        savedId: 2,
        playlistType: "timer",
        activePlaylists: [baseActive({ playlist_id: 1 })],
        selectedMonitors: ["DP-1"],
        extend: false,
      }),
    ).toBe(false);
  });

  it("returns false when extend differs", () => {
    expect(
      shouldSkipPlaylistStartAfterUpdate({
        savedId: 1,
        playlistType: "timer",
        activePlaylists: [baseActive({ monitors: ["DP-1", "DP-2"], extend: false })],
        selectedMonitors: ["DP-1", "DP-2"],
        extend: true,
      }),
    ).toBe(false);
  });

  it("returns false when monitor set differs", () => {
    expect(
      shouldSkipPlaylistStartAfterUpdate({
        savedId: 1,
        playlistType: "timer",
        activePlaylists: [baseActive({ monitors: ["DP-1", "HDMI-A-1"] })],
        selectedMonitors: ["DP-1"],
        extend: false,
      }),
    ).toBe(false);
  });

  it("returns true for timer with same monitors (order-insensitive)", () => {
    expect(
      shouldSkipPlaylistStartAfterUpdate({
        savedId: 1,
        playlistType: "timer",
        activePlaylists: [baseActive({ monitors: ["HDMI-A-1", "DP-1"] })],
        selectedMonitors: ["DP-1", "HDMI-A-1"],
        extend: false,
      }),
    ).toBe(true);
  });

  it("compares the declared monitor set, not the applied subset", () => {
    expect(
      shouldSkipPlaylistStartAfterUpdate({
        savedId: 1,
        playlistType: "timer",
        activePlaylists: [baseActive({ monitors: ["DP-1", "DP-2"], applied_to: ["DP-1"] })],
        selectedMonitors: ["DP-1", "DP-2"],
        extend: false,
      }),
    ).toBe(true);
  });
});
