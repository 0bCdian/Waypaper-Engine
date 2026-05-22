import { describe, it, expect } from "vitest";
import {
  parseWallhavenResolution,
  computeResolutionMatch,
  largestMonitor,
} from "../wallhavenResolutionMatch";

describe("parseWallhavenResolution", () => {
  it("parses standard format '1920x1080'", () => {
    expect(parseWallhavenResolution("1920x1080")).toEqual({ w: 1920, h: 1080 });
  });

  it("parses uppercase X separator", () => {
    expect(parseWallhavenResolution("3840X2160")).toEqual({ w: 3840, h: 2160 });
  });

  it("parses unicode × separator", () => {
    expect(parseWallhavenResolution("2560×1440")).toEqual({ w: 2560, h: 1440 });
  });

  it("returns null for empty string", () => {
    expect(parseWallhavenResolution("")).toBeNull();
  });

  it("returns null for non-numeric input", () => {
    expect(parseWallhavenResolution("AxB")).toBeNull();
  });

  it("returns null for zero dimensions", () => {
    expect(parseWallhavenResolution("0x1080")).toBeNull();
  });

  it("trims whitespace", () => {
    expect(parseWallhavenResolution(" 1920x1080 ")).toEqual({ w: 1920, h: 1080 });
  });
});

// Helper monitor fixture for tests
const mon1080p = { width: 1920, height: 1080 };
const mon1440p = { width: 2560, height: 1440 };
const monUltrawide = { width: 3440, height: 1440 };

describe("computeResolutionMatch", () => {
  it("returns null for unparseable resolution", () => {
    expect(computeResolutionMatch("bad", mon1080p)).toBeNull();
  });

  describe("Exact state", () => {
    it("exact same resolution", () => {
      const result = computeResolutionMatch("1920x1080", mon1080p);
      expect(result?.state).toBe("exact");
      expect(result?.badgeClass).toBe("badge-success");
    });

    it("larger wallpaper with same AR (4K on 1080p monitor)", () => {
      const result = computeResolutionMatch("3840x2160", mon1080p);
      expect(result?.state).toBe("exact");
    });

    it("wallpaper slightly larger, AR delta within 2%", () => {
      // 2560x1440 on 1920x1080 — AR both 16:9, delta = 0%
      const result = computeResolutionMatch("2560x1440", mon1080p);
      expect(result?.state).toBe("exact");
    });
  });

  describe("Good state", () => {
    it("wallpaper covers monitor but AR delta > 2%", () => {
      // 2048x1080 on 1920x1080 — monAR = 1.778, wpAR = 1.896 — delta ~6.7%
      const result = computeResolutionMatch("2048x1080", mon1080p);
      expect(result?.state).toBe("good");
      expect(result?.badgeClass).toBe("badge-neutral");
    });
  });

  describe("Upscale state", () => {
    it("wallpaper width smaller than monitor, same aspect ratio", () => {
      // 1280x720 on 1920x1080 — same 16:9 AR, but both dims smaller → upscale
      const result = computeResolutionMatch("1280x720", mon1080p);
      expect(result?.state).toBe("upscale");
      expect(result?.badgeClass).toBe("badge-warning");
      expect(result?.label).toMatch(/Upscale/);
    });

    it("wallpaper height smaller than monitor", () => {
      // 1920x720 on 1920x1080 — height too small (AR delta ~33%, but upscale check first... wait: crop is first)
      // AR delta = |1920/720 - 1920/1080| / (1920/1080) = |2.667 - 1.778| / 1.778 ≈ 0.5 > 0.25
      // So crop wins. Use less extreme: 1920x900 on 1920x1080
      // AR: wp=2.133, mon=1.778, delta=(2.133-1.778)/1.778=0.2 < 0.25 → no crop
      // wp height 900 < mon height 1080 → upscale
      const result = computeResolutionMatch("1920x900", mon1080p);
      expect(result?.state).toBe("upscale");
    });

    it("label shows scale factor", () => {
      // 960x540 on 1920x1080 — scale = 2.0
      const result = computeResolutionMatch("960x540", mon1080p);
      expect(result?.state).toBe("upscale");
      expect(result?.label).toBe("Upscale 2.0×");
    });

    it("ultrawide monitor, normal wallpaper too narrow", () => {
      // 1920x1080 on 3440x1440 — wp height OK (1080 < 1440 → actually height smaller too)
      const result = computeResolutionMatch("1920x1080", monUltrawide);
      // AR: wp=1.778, mon=2.389, delta=0.611/2.389=0.256 > 0.25 → crop first
      // Crop wins here. Let's verify:
      expect(result?.state).toBe("crop");
    });
  });

  describe("Crop state", () => {
    it("portrait wallpaper on landscape monitor (heavy crop)", () => {
      // 1080x1920 on 1920x1080 — wp AR = 0.5625, mon AR = 1.778
      // delta = |0.5625 - 1.778| / 1.778 ≈ 0.683 > 0.25 → crop
      const result = computeResolutionMatch("1080x1920", mon1080p);
      expect(result?.state).toBe("crop");
      expect(result?.badgeClass).toBe("badge-warning");
      expect(result?.label).toBe("Crop");
    });

    it("very wide panoramic on standard monitor", () => {
      // 7680x1080 on 1920x1080
      // wpAR = 7.111, monAR = 1.778, delta = (7.111-1.778)/1.778 = 2.99 > 0.25 → crop
      const result = computeResolutionMatch("7680x1080", mon1080p);
      expect(result?.state).toBe("crop");
    });

    it("ultrawide wallpaper on 1080p monitor delta >25%", () => {
      // 3440x1440 on 1920x1080 — covers but AR delta: 3440/1440=2.389, 1920/1080=1.778
      // delta = 0.611/1.778 = 0.344 > 0.25 → crop
      const result = computeResolutionMatch("3440x1440", mon1080p);
      expect(result?.state).toBe("crop");
    });
  });

  describe("on 1440p monitor", () => {
    it("4K wallpaper is exact on 1440p", () => {
      // 3840x2160 on 2560x1440 — covers, AR both 16:9
      const result = computeResolutionMatch("3840x2160", mon1440p);
      expect(result?.state).toBe("exact");
    });

    it("1080p wallpaper is upscale on 1440p", () => {
      // 1920x1080 on 2560x1440 — AR same (16:9), but size smaller
      const result = computeResolutionMatch("1920x1080", mon1440p);
      expect(result?.state).toBe("upscale");
    });
  });
});

describe("largestMonitor", () => {
  it("returns null for empty list", () => {
    expect(largestMonitor([])).toBeNull();
  });

  it("returns the single monitor for a single-element list", () => {
    const m = { width: 1920, height: 1080, name: "A" };
    expect(largestMonitor([m])).toBe(m);
  });

  it("returns the monitor with the largest pixel count", () => {
    const monitors = [
      { width: 1920, height: 1080 },
      { width: 3840, height: 2160 },
      { width: 2560, height: 1440 },
    ];
    expect(largestMonitor(monitors)).toBe(monitors[1]);
  });

  it("handles monitors with equal pixel count (returns first match)", () => {
    const a = { width: 1920, height: 1080 };
    const b = { width: 2160, height: 960 }; // same pixel count
    expect(largestMonitor([a, b])).toBe(a);
  });
});
