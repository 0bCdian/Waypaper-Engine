import { describe, it, expect } from "vitest";
import {
  normalizeLegacyWaylandUtauriMonitorName,
  normalizeSelectedMonitors,
  selectedMonitorsOrderChanged,
} from "../monitorNames";

describe("monitorNames", () => {
  it("maps legacy wayland-utauri stable_id to Monitor N", () => {
    expect(normalizeLegacyWaylandUtauriMonitorName("monitor:1:0:0:1920:1080")).toBe("Monitor 1");
    expect(normalizeLegacyWaylandUtauriMonitorName("monitor:0:1920:0:2560:1440")).toBe("Monitor 0");
  });

  it("leaves non-legacy names unchanged", () => {
    expect(normalizeLegacyWaylandUtauriMonitorName("HDMI-A-1")).toBe("HDMI-A-1");
    expect(normalizeLegacyWaylandUtauriMonitorName("Monitor 2")).toBe("Monitor 2");
  });

  it("normalizeSelectedMonitors maps and dedupes", () => {
    expect(
      normalizeSelectedMonitors([
        "monitor:1:0:0:1920:1080",
        "HDMI-A-1",
        "monitor:1:0:0:1920:1080",
      ]),
    ).toEqual(["Monitor 1", "HDMI-A-1"]);
  });

  it("selectedMonitorsOrderChanged detects edits", () => {
    expect(selectedMonitorsOrderChanged(["a"], ["a"])).toBe(false);
    expect(selectedMonitorsOrderChanged(["a"], ["b"])).toBe(true);
    expect(selectedMonitorsOrderChanged(["a", "b"], ["a"])).toBe(true);
  });
});
