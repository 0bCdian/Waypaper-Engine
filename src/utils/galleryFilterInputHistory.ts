/** Recent gallery filter token strings (Creatable values), capped for localStorage size. */

export const GALLERY_FILTER_INPUT_HISTORY_KEY = "waypaper-gallery-filter-input-history";
export const GALLERY_FILTER_INPUT_HISTORY_MAX = 100;

function parseStored(raw: string | null): string[] {
  if (raw == null || raw === "") return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  } catch {
    return [];
  }
}

export function loadGalleryFilterInputHistory(): string[] {
  try {
    return parseStored(localStorage.getItem(GALLERY_FILTER_INPUT_HISTORY_KEY));
  } catch {
    return [];
  }
}

/** Move entry to front, dedupe, cap at GALLERY_FILTER_INPUT_HISTORY_MAX. */
export function recordGalleryFilterInputHistoryEntry(raw: string): void {
  const entry = raw.trim();
  if (!entry) return;
  try {
    const prev = loadGalleryFilterInputHistory();
    const next = [entry, ...prev.filter((x) => x !== entry)].slice(0, GALLERY_FILTER_INPUT_HISTORY_MAX);
    localStorage.setItem(GALLERY_FILTER_INPUT_HISTORY_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearGalleryFilterInputHistory(): void {
  try {
    localStorage.removeItem(GALLERY_FILTER_INPUT_HISTORY_KEY);
  } catch {
    /* ignore */
  }
}
