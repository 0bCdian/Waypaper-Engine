import { describe, it, expect } from "vitest";
import { normalizeSelectedMonitors, selectedMonitorsOrderChanged } from "../monitorNames";

describe("monitorNames", () => {
  it("normalizeSelectedMonitors deduplicates names (first occurrence wins)", () => {
    expect(normalizeSelectedMonitors(["HDMI-A-1", "DP-1", "HDMI-A-1"])).toEqual([
      "HDMI-A-1",
      "DP-1",
    ]);
  });

  it("normalizeSelectedMonitors preserves order when no duplicates", () => {
    expect(normalizeSelectedMonitors(["DP-1", "HDMI-A-1"])).toEqual(["DP-1", "HDMI-A-1"]);
  });

  it("selectedMonitorsOrderChanged detects edits", () => {
    expect(selectedMonitorsOrderChanged(["a"], ["a"])).toBe(false);
    expect(selectedMonitorsOrderChanged(["a"], ["b"])).toBe(true);
    expect(selectedMonitorsOrderChanged(["a", "b"], ["a"])).toBe(true);
  });
});
