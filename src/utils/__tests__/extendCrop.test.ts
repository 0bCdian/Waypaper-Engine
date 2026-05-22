import { describe, it, expect } from "vitest";
import { computeExtendCrop } from "../extendCrop";
import type { Monitor } from "../../../electron/daemon-go-types";

function mon(name: string, partial: Partial<Monitor>): Monitor {
  return {
    name,
    width: 1920,
    height: 1080,
    x: 0,
    y: 0,
    scale: 1,
    refresh_rate: 60,
    transform: 0,
    ...partial,
  };
}

describe("computeExtendCrop", () => {
  it("splits two equal monitors side by side", () => {
    const a = mon("DP-1", { x: 0 });
    const b = mon("DP-2", { x: 1920 });
    const monitors = [a, b];

    const cropA = computeExtendCrop(a, monitors);
    expect(cropA.bbox).toEqual({ x: 0, y: 0, w: 3840, h: 1080 });
    expect(cropA.crop).toEqual({ x: 0, y: 0, w: 1920, h: 1080 });

    const cropB = computeExtendCrop(b, monitors);
    expect(cropB.bbox).toEqual({ x: 0, y: 0, w: 3840, h: 1080 });
    expect(cropB.crop).toEqual({ x: 1920, y: 0, w: 1920, h: 1080 });
  });

  it("normalizes HiDPI physical dimensions to logical pixels", () => {
    // A scale:2 monitor reports 3840x2160 physical but occupies 1920x1080 logical.
    const a = mon("eDP-1", { width: 3840, height: 2160, scale: 2, x: 0 });
    const b = mon("DP-1", { width: 1920, height: 1080, scale: 1, x: 1920 });
    const monitors = [a, b];

    const cropA = computeExtendCrop(a, monitors);
    expect(cropA.bbox).toEqual({ x: 0, y: 0, w: 3840, h: 1080 });
    expect(cropA.crop).toEqual({ x: 0, y: 0, w: 1920, h: 1080 });

    const cropB = computeExtendCrop(b, monitors);
    expect(cropB.crop).toEqual({ x: 1920, y: 0, w: 1920, h: 1080 });
  });

  it("handles a negative-origin layout (bbox not anchored at 0,0)", () => {
    const left = mon("DP-1", { x: -1920 });
    const right = mon("DP-2", { x: 0 });
    const monitors = [left, right];

    const cropLeft = computeExtendCrop(left, monitors);
    expect(cropLeft.bbox).toEqual({ x: -1920, y: 0, w: 3840, h: 1080 });
    expect(cropLeft.crop).toEqual({ x: 0, y: 0, w: 1920, h: 1080 });

    const cropRight = computeExtendCrop(right, monitors);
    expect(cropRight.crop).toEqual({ x: 1920, y: 0, w: 1920, h: 1080 });
  });

  it("handles a vertically stacked layout", () => {
    const top = mon("DP-1", { y: 0 });
    const bottom = mon("DP-2", { y: 1080 });
    const monitors = [top, bottom];

    const cropTop = computeExtendCrop(top, monitors);
    expect(cropTop.bbox).toEqual({ x: 0, y: 0, w: 1920, h: 2160 });
    expect(cropTop.crop).toEqual({ x: 0, y: 0, w: 1920, h: 1080 });

    const cropBottom = computeExtendCrop(bottom, monitors);
    expect(cropBottom.crop).toEqual({ x: 0, y: 1080, w: 1920, h: 1080 });
  });

  it("falls back to the single monitor when the list is empty", () => {
    const a = mon("DP-1", { x: 100, y: 50 });
    const { bbox, crop } = computeExtendCrop(a, []);
    expect(bbox).toEqual({ x: 100, y: 50, w: 1920, h: 1080 });
    expect(crop).toEqual({ x: 0, y: 0, w: 1920, h: 1080 });
  });
});
