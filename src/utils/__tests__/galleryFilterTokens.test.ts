import { describe, it, expect } from "vitest";
import {
  parseGalleryFilterTokens,
  normalizeColorHex,
  parseNearColorSpec,
  mapFiltersToImageQueryParams,
  apiMediaTypeFromFilters,
  clientImageMatchesFilters,
  hasClientSideGalleryFilters,
  galleryHasActiveFilters,
  upsertNearToken,
} from "../galleryFilterTokens";
import type { rendererImage } from "../../types/rendererTypes";
import { defaultGalleryFilters } from "../galleryFilterStorage";

function img(over: Partial<rendererImage> = {}): rendererImage {
  return {
    id: 1,
    name: "x.png",
    path: "/x",
    width: 1920,
    height: 1080,
    format: "png",
    media_type: "image",
    folder_id: null,
    imported_at: "",
    colors: [],
    tags: [],
    time: null,
    ...over,
  } as rendererImage;
}

describe("normalizeColorHex", () => {
  it("accepts 3- and 6-digit hex with optional hash", () => {
    expect(normalizeColorHex("aabbcc")).toBe("#aabbcc");
    expect(normalizeColorHex("#ABC")).toBe("#aabbcc");
  });
  it("rejects invalid", () => {
    expect(normalizeColorHex("gggggg")).toBeNull();
    expect(normalizeColorHex("")).toBeNull();
  });
});

describe("parseGalleryFilterTokens", () => {
  it("parses prefixed tokens and plain search", () => {
    const p = parseGalleryFilterTokens([
      "tag:nature",
      "type:video",
      "ext:PNG",
      "color:#1a2b3c",
      "q:hello world",
      "plain",
    ]);
    expect(p.tags).toEqual(["nature"]);
    expect(p.mediaTypes).toEqual(["video"]);
    expect(p.extensions).toEqual(["png"]);
    expect(p.colors).toEqual(["#1a2b3c"]);
    expect(p.nearColors).toEqual([]);
    expect(p.searchParts).toEqual(["hello world", "plain"]);
  });

  it("parses near: color constraints", () => {
    const p = parseGalleryFilterTokens(["near:#ff0000~10", "near:#00ff00~2.5"]);
    expect(p.nearColors).toEqual([
      { hex: "#ff0000", maxDeltaE: 10 },
      { hex: "#00ff00", maxDeltaE: 2.5 },
    ]);
  });

  it("dedupes identical near constraints", () => {
    const p = parseGalleryFilterTokens(["near:#abc~5", "near:#aabbcc~5"]);
    expect(p.nearColors).toHaveLength(1);
    expect(p.nearColors[0]?.hex).toBe("#aabbcc");
  });

  it("dedupes tags colors extensions types", () => {
    const p = parseGalleryFilterTokens(["tag:a", "tag:a", "color:#fff", "color:#ffffff"]);
    expect(p.tags).toEqual(["a"]);
    expect(p.colors).toEqual(["#ffffff"]);
  });

  it("ignores unknown prefixes as search", () => {
    const p = parseGalleryFilterTokens(["foo:bar"]);
    expect(p.searchParts).toEqual(["foo:bar"]);
  });

  it("multiple type tokens", () => {
    const p = parseGalleryFilterTokens(["type:image", "type:gif"]);
    expect(p.mediaTypes).toEqual(["image", "gif"]);
  });
});

describe("parseNearColorSpec", () => {
  it("parses hex and max delta", () => {
    expect(parseNearColorSpec("  #ff00ff ~ 12 ")).toEqual({
      hex: "#ff00ff",
      maxDeltaE: 12,
    });
  });
  it("returns null when invalid", () => {
    expect(parseNearColorSpec("nope")).toBeNull();
    expect(parseNearColorSpec("#fff~-1")).toBeNull();
  });
});

describe("mapFiltersToImageQueryParams", () => {
  const baseFilterFields = {
    paletteSimilarToId: null,
    paletteSimilarMaxDeltaE: 18,
    hueGroup: null,
  } as const;

  it("maps sort and combined API fields", () => {
    const q = mapFiltersToImageQueryParams({
      order: "asc",
      type: "name",
      mediaType: "all",
      filterTokens: ["q:findme", "tag:t1", "tag:t2", "color:#000000"],
      ...baseFilterFields,
    });
    expect(q.sort_by).toBe("name");
    expect(q.sort_order).toBe("asc");
    expect(q.search).toBe("findme");
    expect(q.tags).toBe("t1,t2");
    expect(q.colors).toBe("#000000");
    expect(q.colors_near).toBeUndefined();
    expect(q.media_type).toBeUndefined();
  });

  it("maps near: tokens to colors_near", () => {
    const q = mapFiltersToImageQueryParams({
      order: "desc",
      type: "id",
      mediaType: "all",
      filterTokens: ["near:#ff0000~10", "near:#00ff00~3"],
      ...baseFilterFields,
    });
    expect(q.colors_near).toBe("#ff0000~10,#00ff00~3");
  });

  it("uses toolbar media type when no type: tokens", () => {
    const q = mapFiltersToImageQueryParams({
      order: "desc",
      type: "id",
      mediaType: "web",
      filterTokens: [],
      ...baseFilterFields,
    });
    expect(q.media_type).toBe("web");
  });

  it("omits media_type when multiple type: tokens (client OR)", () => {
    const q = mapFiltersToImageQueryParams({
      order: "desc",
      type: "id",
      mediaType: "all",
      filterTokens: ["type:image", "type:video"],
      ...baseFilterFields,
    });
    expect(q.media_type).toBeUndefined();
  });

  it("maps palette similarity fields", () => {
    const q = mapFiltersToImageQueryParams({
      ...defaultGalleryFilters(),
      paletteSimilarToId: 42,
      paletteSimilarMaxDeltaE: 22,
    });
    expect(q.palette_similar_to).toBe(42);
    expect(q.palette_max_delta_e).toBe(22);
  });
});

describe("apiMediaTypeFromFilters", () => {
  it("prefers single token type over toolbar", () => {
    const parsed = parseGalleryFilterTokens(["type:gif"]);
    expect(apiMediaTypeFromFilters("image", parsed)).toBe("gif");
  });
});

describe("clientImageMatchesFilters", () => {
  it("filters by extension", () => {
    const parsed = parseGalleryFilterTokens(["ext:png"]);
    expect(
      clientImageMatchesFilters(img(), parsed, "all", {
        constraint: "all",
        width: 0,
        height: 0,
      }),
    ).toBe(true);
    expect(
      clientImageMatchesFilters(img({ format: "jpg" }), parsed, "all", {
        constraint: "all",
        width: 0,
        height: 0,
      }),
    ).toBe(false);
  });

  it("ORs multiple media types from tokens", () => {
    const parsed = parseGalleryFilterTokens(["type:image", "type:gif"]);
    expect(
      clientImageMatchesFilters(img({ media_type: "image" }), parsed, "all", {
        constraint: "all",
        width: 0,
        height: 0,
      }),
    ).toBe(true);
    expect(
      clientImageMatchesFilters(img({ media_type: "gif" }), parsed, "all", {
        constraint: "all",
        width: 0,
        height: 0,
      }),
    ).toBe(true);
    expect(
      clientImageMatchesFilters(img({ media_type: "video" }), parsed, "all", {
        constraint: "all",
        width: 0,
        height: 0,
      }),
    ).toBe(false);
  });
});

describe("hasClientSideGalleryFilters", () => {
  it("true for extensions or multi-type or sized resolution", () => {
    const emptyRes = { constraint: "all" as const, width: 0, height: 0 };
    expect(
      hasClientSideGalleryFilters(parseGalleryFilterTokens(["ext:png"]), "all", emptyRes),
    ).toBe(true);
    expect(
      hasClientSideGalleryFilters(parseGalleryFilterTokens(["tag:only"]), "all", emptyRes),
    ).toBe(false);
    expect(
      hasClientSideGalleryFilters(
        parseGalleryFilterTokens(["type:image", "type:gif"]),
        "all",
        emptyRes,
      ),
    ).toBe(true);
    expect(
      hasClientSideGalleryFilters(parseGalleryFilterTokens([]), "all", {
        constraint: "exact",
        width: 1,
        height: 0,
      }),
    ).toBe(true);
  });
});

describe("galleryHasActiveFilters", () => {
  it("respects tokens, media, and resolution constraint mode", () => {
    const base = defaultGalleryFilters();
    expect(galleryHasActiveFilters({ ...base, filterTokens: ["q:x"] })).toBe(true);
    expect(galleryHasActiveFilters({ ...base, mediaType: "image" })).toBe(true);
    expect(
      galleryHasActiveFilters({
        ...base,
        advancedFilters: {
          resolution: { constraint: "exact", width: 0, height: 0 },
        },
      }),
    ).toBe(true);
    expect(galleryHasActiveFilters({ ...base, paletteSimilarToId: 7 })).toBe(true);
    expect(galleryHasActiveFilters(base)).toBe(false);
  });
});

describe("hue group filter mapping", () => {
  const baseFilters = {
    order: "desc" as const,
    type: "id" as const,
    mediaType: "all" as const,
    filterTokens: [] as string[],
    paletteSimilarToId: null,
    paletteSimilarMaxDeltaE: 18,
    hueGroup: null as number | null,
  };

  it("omits hue_group when null", () => {
    const params = mapFiltersToImageQueryParams(baseFilters);
    expect(params.hue_group).toBeUndefined();
  });

  it("emits hue_group when set", () => {
    const params = mapFiltersToImageQueryParams({ ...baseFilters, hueGroup: 4 });
    expect(params.hue_group).toBe(4);
  });

  it("emits neutral group 99", () => {
    const params = mapFiltersToImageQueryParams({ ...baseFilters, hueGroup: 99 });
    expect(params.hue_group).toBe(99);
  });

  it("maps type hue to sort_by hue", () => {
    const params = mapFiltersToImageQueryParams({ ...baseFilters, type: "hue", order: "asc" });
    expect(params.sort_by).toBe("hue");
    expect(params.sort_order).toBe("asc");
  });
});

describe("upsertNearToken", () => {
  it("appends a normalized near: token", () => {
    expect(upsertNearToken(["tag:nature"], "#3AA7A0", 25)).toEqual([
      "tag:nature",
      "near:#3aa7a0~25",
    ]);
  });

  it("expands #rgb shorthand", () => {
    expect(upsertNearToken([], "#f80", 25)).toEqual(["near:#ff8800~25"]);
  });

  it("replaces existing near: tokens instead of accumulating", () => {
    expect(
      upsertNearToken(["near:#ff0000~10", "tag:sky", "near:#00ff00~5"], "#0000ff", 25),
    ).toEqual(["tag:sky", "near:#0000ff~25"]);
  });

  it("returns tokens unchanged for an invalid hex", () => {
    const tokens = ["tag:sky"];
    expect(upsertNearToken(tokens, "notahex", 25)).toBe(tokens);
  });
});
