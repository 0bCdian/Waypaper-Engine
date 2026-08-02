import { describe, expect, it } from "vitest";
import { monitorSetsMatch } from "../useSetLastActivePlaylist";

describe("monitorSetsMatch", () => {
  it("matches identical monitor sets", () => {
    expect(monitorSetsMatch(["DP-1"], ["DP-1"])).toBe(true);
  });

  it("matches regardless of order", () => {
    expect(monitorSetsMatch(["DP-1", "DP-2"], ["DP-2", "DP-1"])).toBe(true);
  });

  it("rejects a subset", () => {
    expect(monitorSetsMatch(["DP-1"], ["DP-1", "DP-2"])).toBe(false);
  });

  it("rejects disjoint sets of the same size", () => {
    expect(monitorSetsMatch(["DP-1"], ["HDMI-A-1"])).toBe(false);
  });
});
