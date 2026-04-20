import { describe, it, expect } from "vitest";
import { FILTER_PREFIX_OPTIONS } from "../galleryFilterSuggestions";

describe("FILTER_PREFIX_OPTIONS", () => {
  it("lists token prefixes for the cheatsheet", () => {
    expect(FILTER_PREFIX_OPTIONS).toEqual(["tag:", "type:", "ext:", "color:", "near:", "q:"]);
  });
});
