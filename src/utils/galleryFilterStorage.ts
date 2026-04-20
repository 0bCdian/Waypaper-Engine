import type { Filters, advancedFilters } from "../types/rendererTypes";
import type { Formats } from "../../shared/types/image";

function parseSearchInput(text: string): { search: string; hashTags: string[] } {
  const hashTags: string[] = [];
  const search = text
    .replace(/#(\S+)/g, (_, tag: string) => {
      hashTags.push(tag);
      return "";
    })
    .trim();
  return { search, hashTags };
}

export const GALLERY_FILTERS_STORAGE_KEY = "waypaper-gallery-filters";

const ALL_FORMATS: Formats[] = [
  "jpeg",
  "jpg",
  "webp",
  "gif",
  "png",
  "bmp",
  "tiff",
  "tga",
  "pnm",
  "farbfeld",
];

function defaultAdvancedFilters(): advancedFilters {
  return {
    resolution: {
      constraint: "all",
      width: 0,
      height: 0,
    },
  };
}

export function defaultGalleryFilters(): Filters {
  return {
    order: "desc",
    type: "id",
    mediaType: "all",
    filterTokens: [],
    advancedFilters: defaultAdvancedFilters(),
  };
}

/** Legacy shape before filterTokens (v1). */
interface LegacyFiltersV1 {
  order?: "asc" | "desc";
  type?: "name" | "id";
  mediaType?: "all" | "image" | "video" | "web" | "gif";
  searchString?: string;
  tags?: string[];
  advancedFilters?: {
    formats?: string[];
    resolution?: advancedFilters["resolution"];
    colors?: string[];
  };
}

function migrateFromLegacyV1(raw: LegacyFiltersV1): Filters {
  const tokens: string[] = [];

  const search = raw.searchString?.trim() ?? "";
  if (search) {
    const { search: plain, hashTags } = parseSearchInput(search);
    for (const t of hashTags) {
      tokens.push(`tag:${t}`);
    }
    if (plain.trim()) {
      tokens.push(`q:${plain.trim()}`);
    }
  }

  for (const t of raw.tags ?? []) {
    if (t) tokens.push(`tag:${t}`);
  }

  for (const c of raw.advancedFilters?.colors ?? []) {
    if (c) tokens.push(`color:${c}`);
  }

  const formats = raw.advancedFilters?.formats ?? ALL_FORMATS;
  if (formats.length > 0 && formats.length < ALL_FORMATS.length) {
    for (const f of formats) {
      tokens.push(`ext:${f}`);
    }
  }

  const resolution = raw.advancedFilters?.resolution ?? {
    constraint: "all" as const,
    width: 0,
    height: 0,
  };

  return {
    order: raw.order ?? "desc",
    type: raw.type ?? "id",
    mediaType: raw.mediaType ?? "all",
    filterTokens: [...new Set(tokens)],
    advancedFilters: { resolution },
  };
}

function isPersistedV2(o: Record<string, unknown>): boolean {
  return Array.isArray(o.filterTokens);
}

function isLegacyV1(o: Record<string, unknown>): boolean {
  return "searchString" in o || "tags" in o;
}

function normalizeV2(o: Record<string, unknown>): Filters {
  const base = defaultGalleryFilters();
  const f = o as Partial<Filters>;
  return {
    order: f.order === "asc" || f.order === "desc" ? f.order : base.order,
    type: f.type === "name" || f.type === "id" ? f.type : base.type,
    mediaType:
      f.mediaType === "all" ||
      f.mediaType === "image" ||
      f.mediaType === "video" ||
      f.mediaType === "web" ||
      f.mediaType === "gif"
        ? f.mediaType
        : base.mediaType,
    filterTokens: Array.isArray(f.filterTokens)
      ? f.filterTokens.filter((t): t is string => typeof t === "string")
      : base.filterTokens,
    advancedFilters: {
      resolution: {
        constraint:
          f.advancedFilters?.resolution?.constraint === "exact" ||
          f.advancedFilters?.resolution?.constraint === "lessThan" ||
          f.advancedFilters?.resolution?.constraint === "moreThan" ||
          f.advancedFilters?.resolution?.constraint === "all"
            ? f.advancedFilters!.resolution.constraint
            : base.advancedFilters.resolution.constraint,
        width: Number(f.advancedFilters?.resolution?.width) || 0,
        height: Number(f.advancedFilters?.resolution?.height) || 0,
      },
    },
  };
}

export function loadGalleryFiltersFromStorage(): Filters {
  try {
    const raw = localStorage.getItem(GALLERY_FILTERS_STORAGE_KEY);
    if (!raw) return defaultGalleryFilters();
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return defaultGalleryFilters();
    const o = parsed as Record<string, unknown>;

    if (isPersistedV2(o)) {
      return normalizeV2(o);
    }
    if (isLegacyV1(o)) {
      const migrated = migrateFromLegacyV1(o as LegacyFiltersV1);
      persistGalleryFilters(migrated);
      return migrated;
    }
    return normalizeV2(o);
  } catch {
    return defaultGalleryFilters();
  }
}

export function persistGalleryFilters(filters: Filters): void {
  try {
    localStorage.setItem(GALLERY_FILTERS_STORAGE_KEY, JSON.stringify(filters));
  } catch {
    /* ignore quota */
  }
}
