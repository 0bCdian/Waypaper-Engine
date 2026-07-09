import { describe, it, expect } from "vitest";
import {
  getThumbnailSrc,
  toSeconds,
  toHoursAndMinutes,
  parseResolution,
  fitMonitorLayout,
} from "../utilities";
import type { Image, Monitor } from "../../../electron/daemon-go-types";

describe("getThumbnailSrc", () => {
  const baseThumbnails: Image["thumbnails"] = {
    default: "/thumbs/default.jpg",
    "720p": "/thumbs/720p.jpg",
    "1080p": "/thumbs/1080p.jpg",
    "1440p": "/thumbs/1440p.jpg",
    "4k": "/thumbs/4k.jpg",
  };

  it("returns preferred size when available", () => {
    const img = { thumbnails: baseThumbnails, path: "/img.jpg" };
    expect(getThumbnailSrc(img, "1080p")).toBe("/thumbs/1080p.jpg");
  });

  it("falls back to default when preferred size is empty", () => {
    const img = {
      thumbnails: { ...baseThumbnails, "4k": "  " },
      path: "/img.jpg",
    };
    expect(getThumbnailSrc(img, "4k")).toBe("/thumbs/default.jpg");
  });

  it("returns default thumbnail when no preferred size given", () => {
    const img = { thumbnails: baseThumbnails, path: "/img.jpg" };
    expect(getThumbnailSrc(img)).toBe("/thumbs/default.jpg");
  });

  it("falls back to 720p when default is empty", () => {
    const img = {
      thumbnails: { ...baseThumbnails, default: "" },
      path: "/img.jpg",
    };
    expect(getThumbnailSrc(img)).toBe("/thumbs/720p.jpg");
  });

  it("falls back to path when all thumbnails are empty", () => {
    const img = {
      thumbnails: {
        default: "",
        "720p": "",
        "1080p": "",
        "1440p": "",
        "4k": "",
      },
      path: "/img.jpg",
    };
    expect(getThumbnailSrc(img)).toBe("/img.jpg");
  });

  it("handles undefined thumbnails", () => {
    const img = {
      thumbnails: undefined as unknown as Image["thumbnails"],
      path: "/img.jpg",
    };
    expect(getThumbnailSrc(img)).toBe("/img.jpg");
  });

  it("returns original path for gif media even when thumbnails exist", () => {
    const img = {
      thumbnails: baseThumbnails,
      path: "/animated.gif",
      media_type: "gif",
    };
    expect(getThumbnailSrc(img)).toBe("/animated.gif");
  });

  it("returns empty string for web wallpapers when thumbnails missing (path is HTML)", () => {
    const img = {
      thumbnails: {
        default: "",
        "720p": "",
        "1080p": "",
        "1440p": "",
        "4k": "",
      },
      path: "atom://pkg/index.html",
      media_type: "web",
      format: "html",
    };
    expect(getThumbnailSrc(img)).toBe("");
  });
});

describe("toSeconds", () => {
  it("converts hours and minutes to seconds", () => {
    expect(toSeconds(1, 30)).toBe(5400);
  });

  it("handles zero values", () => {
    expect(toSeconds(0, 0)).toBe(0);
  });

  it("handles minutes only", () => {
    expect(toSeconds(0, 45)).toBe(2700);
  });

  it("handles hours only", () => {
    expect(toSeconds(2, 0)).toBe(7200);
  });
});

describe("toHoursAndMinutes", () => {
  it("converts seconds to hours and minutes", () => {
    expect(toHoursAndMinutes(5400)).toEqual({ hours: 1, minutes: 30 });
  });

  it("handles zero", () => {
    expect(toHoursAndMinutes(0)).toEqual({ hours: 0, minutes: 0 });
  });

  it("drops leftover seconds", () => {
    expect(toHoursAndMinutes(3661)).toEqual({ hours: 1, minutes: 1 });
  });

  it("handles large values", () => {
    expect(toHoursAndMinutes(86400)).toEqual({ hours: 24, minutes: 0 });
  });
});

describe("parseResolution", () => {
  it("parses standard resolution string", () => {
    expect(parseResolution("1920x1080")).toEqual({
      width: 1920,
      height: 1080,
    });
  });

  it("parses 4K resolution", () => {
    expect(parseResolution("3840x2160")).toEqual({
      width: 3840,
      height: 2160,
    });
  });
});

describe("fitMonitorLayout", () => {
  const box = { width: 600, height: 400 };

  function monitor(name: string, width: number, height: number, x: number, y: number): Monitor {
    return { name, width, height, x, y, scale: 1, refresh_rate: 60, transform: 0 };
  }

  it("fits stacked monitors by height so the layout never exceeds the box", () => {
    // Issue #225: two 2560x1440 monitors stacked vertically (bbox 2560x2880).
    const monitors = [monitor("DP-1", 2560, 1440, 0, 0), monitor("eDP-1", 2560, 1440, 0, 1440)];

    const layout = fitMonitorLayout(monitors, box);

    // Height is the binding constraint: 400 / 2880
    expect(layout.scale).toBeCloseTo(400 / 2880);
    expect(layout.width).toBeCloseTo(2560 * (400 / 2880));
    expect(layout.height).toBeCloseTo(400);
    expect(layout.width).toBeLessThanOrEqual(box.width);
    expect(layout.height).toBeLessThanOrEqual(box.height);
  });

  it("fits side-by-side monitors by width", () => {
    const monitors = [monitor("A", 2560, 1440, 0, 0), monitor("B", 2560, 1440, 2560, 0)];

    const layout = fitMonitorLayout(monitors, box);

    // Width is the binding constraint: 600 / 5120
    expect(layout.scale).toBeCloseTo(600 / 5120);
    expect(layout.width).toBeCloseTo(600);
    expect(layout.height).toBeCloseTo(1440 * (600 / 5120));
  });

  it("normalizes negative origins so all positions stay inside the layout", () => {
    const monitors = [monitor("A", 1920, 1080, -1920, 0), monitor("B", 1920, 1080, 0, 0)];

    const layout = fitMonitorLayout(monitors, box);

    expect(layout.origin).toEqual({ x: -1920, y: 0 });
    // Bounding box is 3840x1080; width binds: 600 / 3840
    expect(layout.scale).toBeCloseTo(600 / 3840);
    expect(layout.width).toBeCloseTo(600);
    // Position of monitor A relative to origin lands at 0, B at half the width
    expect((monitors[0].x - layout.origin.x) * layout.scale).toBeCloseTo(0);
    expect((monitors[1].x - layout.origin.x) * layout.scale).toBeCloseTo(300);
  });

  it("fits a single monitor", () => {
    const layout = fitMonitorLayout([monitor("A", 1920, 1080, 0, 0)], box);

    // Width binds: 600 / 1920
    expect(layout.scale).toBeCloseTo(600 / 1920);
    expect(layout.width).toBeCloseTo(600);
    expect(layout.height).toBeCloseTo(1080 * (600 / 1920));
  });

  it("returns an empty layout for no monitors", () => {
    expect(fitMonitorLayout([], box)).toEqual({
      scale: 0,
      width: 0,
      height: 0,
      origin: { x: 0, y: 0 },
    });
  });
});
