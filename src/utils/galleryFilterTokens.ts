import type { ImageQueryParams } from "../../electron/daemon-go-types";
import type { Filters, rendererImage } from "../types/rendererTypes";
import type { resolutionConstraints } from "../types/rendererTypes";

const VALID_MEDIA = new Set(["image", "video", "gif", "web"]);

export interface ColorNearSpec {
  hex: string;
  maxDeltaE: number;
}

export interface ParsedGalleryTokens {
  searchParts: string[];
  tags: string[];
  mediaTypes: string[];
  extensions: string[];
  colors: string[];
  /** Perceptual color match (CIE76 ΔE vs stored palette swatches). */
  nearColors: ColorNearSpec[];
}

export interface ResolutionFilter {
  constraint: resolutionConstraints;
  width: number;
  height: number;
}

function splitPrefix(token: string): { key: string; rest: string } | null {
  const idx = token.indexOf(":");
  if (idx <= 0) return null;
  return { key: token.slice(0, idx).toLowerCase(), rest: token.slice(idx + 1) };
}

/** Normalize hex for daemon palette Contains (lowercase, leading #, #rgb expanded to #rrggbb). */
export function normalizeColorHex(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  const hex = s.startsWith("#") ? s : `#${s}`;
  if (!/^#[0-9a-f]{3}([0-9a-f]{3})?$/.test(hex)) return null;
  if (hex.length === 4) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`.toLowerCase();
  }
  return hex;
}

/** Parses `near:#hex~maxDeltaE` (CIE76). */
export function parseNearColorSpec(rest: string): ColorNearSpec | null {
  const v = rest.trim();
  const idx = v.lastIndexOf("~");
  if (idx <= 0 || idx >= v.length - 1) return null;
  const hex = normalizeColorHex(v.slice(0, idx));
  const n = parseFloat(v.slice(idx + 1));
  if (hex == null || !Number.isFinite(n) || n < 0) return null;
  return { hex, maxDeltaE: n };
}

export function parseGalleryFilterTokens(tokens: string[]): ParsedGalleryTokens {
  const searchParts: string[] = [];
  const tags: string[] = [];
  const mediaTypes: string[] = [];
  const extensions: string[] = [];
  const colors: string[] = [];
  const nearColors: ColorNearSpec[] = [];

  for (const raw of tokens) {
    const token = raw.trim();
    if (!token) continue;

    const sp = splitPrefix(token);
    if (!sp) {
      searchParts.push(token);
      continue;
    }

    const { key, rest } = sp;
    const v = rest.trim();
    if (!v) continue;

    switch (key) {
      case "tag":
        tags.push(v);
        break;
      case "type": {
        const t = v.toLowerCase();
        if (VALID_MEDIA.has(t)) mediaTypes.push(t);
        break;
      }
      case "ext": {
        const e = v.toLowerCase().replace(/^\./, "");
        if (e) extensions.push(e);
        break;
      }
      case "color": {
        const hex = normalizeColorHex(v);
        if (hex) colors.push(hex);
        break;
      }
      case "near": {
        const spec = parseNearColorSpec(v);
        if (spec) nearColors.push(spec);
        break;
      }
      case "q":
        searchParts.push(v);
        break;
      default:
        searchParts.push(token);
    }
  }

  const nearDedup = new Map<string, ColorNearSpec>();
  for (const n of nearColors) {
    const k = `${n.hex}~${n.maxDeltaE}`;
    if (!nearDedup.has(k)) nearDedup.set(k, n);
  }

  return {
    searchParts,
    tags: [...new Set(tags)],
    mediaTypes: [...new Set(mediaTypes)],
    extensions: [...new Set(extensions)],
    colors: [...new Set(colors)],
    nearColors: [...nearDedup.values()],
  };
}

function parsedTokensToSearchString(parsed: ParsedGalleryTokens): string | undefined {
  const s = parsed.searchParts.join(" ").trim();
  return s || undefined;
}

/** Single media_type for daemon when exactly one narrow type is selected. */
export function apiMediaTypeFromFilters(
  mediaType: "all" | "image" | "video" | "web" | "gif",
  parsed: ParsedGalleryTokens,
): "image" | "video" | "gif" | "web" | undefined {
  if (parsed.mediaTypes.length > 1) return undefined;
  if (parsed.mediaTypes.length === 1) {
    return parsed.mediaTypes[0] as "image" | "video" | "gif" | "web";
  }
  if (mediaType === "all") return undefined;
  return mediaType;
}

export function mapFiltersToImageQueryParams(
  filters: Pick<
    Filters,
    | "order"
    | "type"
    | "mediaType"
    | "filterTokens"
    | "paletteSimilarToId"
    | "paletteSimilarMaxDeltaE"
    | "hueGroup"
  >,
): Partial<ImageQueryParams> {
  const parsed = parseGalleryFilterTokens(filters.filterTokens);
  const search = parsedTokensToSearchString(parsed);
  const mt = apiMediaTypeFromFilters(filters.mediaType, parsed);
  const colorsNear =
    parsed.nearColors.length > 0
      ? parsed.nearColors.map((c) => `${c.hex}~${c.maxDeltaE}`).join(",")
      : undefined;

  const out: Partial<ImageQueryParams> = {
    sort_by: filters.type === "name" ? "name" : filters.type === "hue" ? "hue" : "imported_at",
    sort_order: filters.order,
    media_type: mt,
    search,
    tags: parsed.tags.length > 0 ? parsed.tags.join(",") : undefined,
    colors: parsed.colors.length > 0 ? parsed.colors.join(",") : undefined,
    colors_near: colorsNear,
  };

  if (filters.paletteSimilarToId != null) {
    out.palette_similar_to = filters.paletteSimilarToId;
    out.palette_max_delta_e = filters.paletteSimilarMaxDeltaE;
  }

  if (filters.hueGroup != null) {
    out.hue_group = filters.hueGroup;
  }

  return out;
}

function effectiveMediaTypes(
  mediaType: "all" | "image" | "video" | "web" | "gif",
  parsed: ParsedGalleryTokens,
): string[] {
  if (parsed.mediaTypes.length > 0) return parsed.mediaTypes;
  if (mediaType !== "all") return [mediaType];
  return [];
}

export function clientImageMatchesFilters(
  image: rendererImage,
  parsed: ParsedGalleryTokens,
  mediaType: "all" | "image" | "video" | "web" | "gif",
  resolution: ResolutionFilter,
): boolean {
  const types = effectiveMediaTypes(mediaType, parsed);
  if (types.length > 1) {
    const m = (image.media_type || "").toLowerCase();
    if (!types.includes(m)) return false;
  }

  if (parsed.extensions.length > 0) {
    const fmt = (image.format || "").toLowerCase();
    if (!parsed.extensions.includes(fmt)) return false;
  }

  const dontFilterByResolution =
    resolution.constraint === "all" || resolution.width + resolution.height === 0;

  if (!dontFilterByResolution) {
    const w = resolution.width;
    const h = resolution.height;
    switch (resolution.constraint) {
      case "exact":
        if (!((w === 0 || image.width === w) && (h === 0 || image.height === h))) return false;
        break;
      case "lessThan":
        if (!((w === 0 || image.width <= w) && (h === 0 || image.height <= h))) return false;
        break;
      case "moreThan":
        if (!((w === 0 || image.width >= w) && (h === 0 || image.height >= h))) return false;
        break;
    }
  }

  return true;
}

export function hasClientSideGalleryFilters(
  parsed: ParsedGalleryTokens,
  mediaType: "all" | "image" | "video" | "web" | "gif",
  resolution: ResolutionFilter,
): boolean {
  if (parsed.extensions.length > 0) return true;
  const types = effectiveMediaTypes(mediaType, parsed);
  if (types.length > 1) return true;
  const resActive = resolution.constraint !== "all" && resolution.width + resolution.height > 0;
  return resActive;
}

/** True when the gallery is narrowed beyond “everything in folder” (empty state vs grid). */
export function galleryHasActiveFilters(filters: Filters): boolean {
  if (filters.filterTokens.length > 0) return true;
  if (filters.mediaType !== "all") return true;
  if (filters.paletteSimilarToId != null) return true;
  if (filters.hueGroup != null) return true;
  if (filters.advancedFilters.resolution.constraint !== "all") return true;
  const parsed = parseGalleryFilterTokens(filters.filterTokens);
  return hasClientSideGalleryFilters(parsed, filters.mediaType, filters.advancedFilters.resolution);
}
