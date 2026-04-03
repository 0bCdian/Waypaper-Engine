import { describe, expect, it } from "vitest";
import { webPreviewPlaybackKind } from "../webPreviewPlayback";

describe("webPreviewPlaybackKind", () => {
  it("returns animatedImage for .gif", () => {
    expect(webPreviewPlaybackKind("/pkg/preview.gif")).toBe("animatedImage");
    expect(webPreviewPlaybackKind("C:\\pkg\\Preview.GIF")).toBe("animatedImage");
  });

  it("returns video for common video extensions", () => {
    expect(webPreviewPlaybackKind("/p/clip.mp4")).toBe("video");
    expect(webPreviewPlaybackKind("/p/x.webm")).toBe("video");
  });

  it("returns null for static raster previews", () => {
    expect(webPreviewPlaybackKind("/p/thumb.png")).toBeNull();
    expect(webPreviewPlaybackKind("/p/x.webp")).toBeNull();
    expect(webPreviewPlaybackKind("")).toBeNull();
    expect(webPreviewPlaybackKind(undefined)).toBeNull();
  });
});
