import { describe, expect, it } from "vitest";
import { isAllowedYoutubeUrl } from "./youtubeUrl";

describe("isAllowedYoutubeUrl", () => {
  it("accepts watch and short URLs", () => {
    expect(isAllowedYoutubeUrl("https://www.youtube.com/watch?v=abc123")).toBe(true);
    expect(isAllowedYoutubeUrl("https://youtu.be/abc123")).toBe(true);
    expect(isAllowedYoutubeUrl("  https://m.youtube.com/watch?v=x  ")).toBe(true);
  });

  it("rejects non-YouTube hosts and non-http", () => {
    expect(isAllowedYoutubeUrl("https://example.com/watch?v=1")).toBe(false);
    expect(isAllowedYoutubeUrl("file:///tmp/x")).toBe(false);
    expect(isAllowedYoutubeUrl("not a url")).toBe(false);
  });
});
