import { describe, it, expect } from "vitest";
import {
  getThumbnailSrc,
  toSeconds,
  toHoursAndMinutes,
  parseResolution,
  calculateMinResolution,
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
    const img = { thumbnails: undefined as unknown as Image["thumbnails"], path: "/img.jpg" };
    expect(getThumbnailSrc(img)).toBe("/img.jpg");
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

describe("calculateMinResolution", () => {
  it("calculates bounding box for single monitor", () => {
    const monitors: Monitor[] = [
      {
        name: "A",
        width: 1920,
        height: 1080,
        x: 0,
        y: 0,
        scale: 1,
        refresh_rate: 60,
        transform: 0,
      },
    ];
    expect(calculateMinResolution(monitors)).toEqual({ x: 1920, y: 1080 });
  });

  it("calculates bounding box for side-by-side monitors", () => {
    const monitors: Monitor[] = [
      {
        name: "A",
        width: 1920,
        height: 1080,
        x: 0,
        y: 0,
        scale: 1,
        refresh_rate: 60,
        transform: 0,
      },
      {
        name: "B",
        width: 2560,
        height: 1440,
        x: 1920,
        y: 0,
        scale: 1,
        refresh_rate: 144,
        transform: 0,
      },
    ];
    expect(calculateMinResolution(monitors)).toEqual({ x: 4480, y: 1440 });
  });

  it("calculates bounding box for stacked monitors", () => {
    const monitors: Monitor[] = [
      {
        name: "A",
        width: 1920,
        height: 1080,
        x: 0,
        y: 0,
        scale: 1,
        refresh_rate: 60,
        transform: 0,
      },
      {
        name: "B",
        width: 1920,
        height: 1080,
        x: 0,
        y: 1080,
        scale: 1,
        refresh_rate: 60,
        transform: 0,
      },
    ];
    expect(calculateMinResolution(monitors)).toEqual({ x: 1920, y: 2160 });
  });

  it("returns zeros for empty array", () => {
    expect(calculateMinResolution([])).toEqual({ x: 0, y: 0 });
  });
});
