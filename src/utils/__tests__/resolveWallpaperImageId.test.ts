import { describe, expect, it } from "vitest";
import type { WallpaperCurrent } from "../../../electron/daemon-go-types";
import { resolveWallpaperImageId } from "../resolveWallpaperImageId";

function slot(
  monitor_name: string,
  image_id: number,
): NonNullable<WallpaperCurrent["monitors"]>[number] {
  return {
    monitor_name,
    image_id,
    image_name: "x",
    image_path: "/x",
    set_at: "2026-01-01T00:00:00Z",
  };
}

describe("resolveWallpaperImageId", () => {
  it("returns image_id for exact monitor_name match", () => {
    const current: WallpaperCurrent = {
      backend: "awww",
      image_id: 2,
      image_name: "a",
      image_path: "/a",
      mode: "individual",
      monitors: [slot("DP-1", 2), slot("HDMI-A-1", 3)],
    };
    expect(resolveWallpaperImageId(current, "HDMI-A-1")).toBe(3);
  });

  it("matches legacy stable_id row to Monitor N label", () => {
    const current: WallpaperCurrent = {
      backend: "wayland-utauri",
      image_id: 9,
      image_name: "w",
      image_path: "/w",
      mode: "individual",
      monitors: [slot("monitor:0:0:0:1920:1080", 9)],
    };
    expect(resolveWallpaperImageId(current, "Monitor 0")).toBe(9);
  });

  it("uses top-level image_id for clone when there is no per-monitor row", () => {
    const current: WallpaperCurrent = {
      backend: "feh",
      image_id: 42,
      image_name: "c",
      image_path: "/c",
      mode: "clone",
      monitors: [slot("DP-1", 42)],
    };
    expect(resolveWallpaperImageId(current, "HDMI-A-1")).toBe(42);
  });

  it("uses top-level image_id for extend when there is no per-monitor row", () => {
    const current: WallpaperCurrent = {
      backend: "feh",
      image_id: 7,
      image_name: "e",
      image_path: "/e",
      mode: "extend",
      monitors: [slot("DP-1", 7)],
    };
    expect(resolveWallpaperImageId(current, "DP-2")).toBe(7);
  });

  it("returns null for individual mode when the monitor has no matching slot", () => {
    const current: WallpaperCurrent = {
      backend: "feh",
      image_id: 1,
      image_name: "a",
      image_path: "/a",
      mode: "individual",
      monitors: [slot("DP-1", 1)],
    };
    expect(resolveWallpaperImageId(current, "OTHER")).toBeNull();
  });
});
