import { describe, expect, it } from "vitest";
import { loopStudioMediaSrc } from "../mediaUrl";

describe("loopStudioMediaSrc", () => {
  it("passes through atom://", () => {
    expect(loopStudioMediaSrc("atom://home/u/v.mp4")).toBe("atom://home/u/v.mp4");
  });

  it("normalizes atom: to atom://", () => {
    expect(loopStudioMediaSrc("atom:home/u/v.mp4")).toBe("atom://home/u/v.mp4");
  });

  it("maps Unix absolute paths", () => {
    expect(loopStudioMediaSrc("/home/u/.local/v.mp4")).toBe("atom://home/u/.local/v.mp4");
  });

  it("maps Windows drive paths", () => {
    expect(loopStudioMediaSrc("C:\\Users\\u\\v.mp4")).toBe("atom://C:/Users/u/v.mp4");
    expect(loopStudioMediaSrc("D:/x/v.webm")).toBe("atom://D:/x/v.webm");
  });

  it("trims whitespace", () => {
    expect(loopStudioMediaSrc("  atom://a/b  ")).toBe("atom://a/b");
  });
});
