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

  it("returns animatedImage for webp (animated previews; static webp still works as img src)", () => {
    expect(webPreviewPlaybackKind("/pkg/preview.webp")).toBe("animatedImage");
    expect(webPreviewPlaybackKind("C:\\pkg\\Preview.WEBP")).toBe("animatedImage");
  });

  it("returns null for static png/jpg previews", () => {
    expect(webPreviewPlaybackKind("/p/thumb.png")).toBeNull();
    expect(webPreviewPlaybackKind("/p/x.jpg")).toBeNull();
    expect(webPreviewPlaybackKind("")).toBeNull();
    expect(webPreviewPlaybackKind(undefined)).toBeNull();
  });
});
