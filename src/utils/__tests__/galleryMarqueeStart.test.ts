import { describe, expect, it } from "vitest";
import { shouldBlockGalleryMarqueeStart } from "../galleryMarqueeStart";

describe("shouldBlockGalleryMarqueeStart", () => {
  it("blocks gallery thumbnails and folder cards", () => {
    const root = document.createElement("div");
    root.setAttribute("data-gallery-image-root", "true");
    const inner = document.createElement("span");
    root.appendChild(inner);
    expect(shouldBlockGalleryMarqueeStart(inner)).toBe(true);
  });

  it("blocks elements marked to skip", () => {
    const wrap = document.createElement("div");
    wrap.setAttribute("data-prevent-gallery-marquee", "true");
    const inner = document.createElement("div");
    wrap.appendChild(inner);
    expect(shouldBlockGalleryMarqueeStart(inner)).toBe(true);
  });

  it("blocks buttons and inputs", () => {
    const b = document.createElement("button");
    expect(shouldBlockGalleryMarqueeStart(b)).toBe(true);
    const i = document.createElement("input");
    expect(shouldBlockGalleryMarqueeStart(i)).toBe(true);
  });

  it("allows flex gaps (plain section target would not be in Element for jsdom) — unblocked on detached section", () => {
    const s = document.createElement("section");
    expect(shouldBlockGalleryMarqueeStart(s)).toBe(false);
  });
});
