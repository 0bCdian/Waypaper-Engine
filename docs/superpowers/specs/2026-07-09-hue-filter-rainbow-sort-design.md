# Hue Filter Strip + Rainbow Sort — Design

**Date:** 2026-07-09
**Status:** Approved by maintainer
**Inspiration:** skwd-wall's ColorFilterStrip / color-first sorting, adapted to waypaper-engine's stronger palette data.

## Problem

The gallery already stores a k-means CIELAB palette per image (`Image.colors`, hexes ordered by cluster dominance) and supports `color:` / `near:#hex~ΔE` / palette-similarity filters — but all of it is hidden behind text-token syntax. There is no one-click, discoverable way to browse by color, and no color-aware sort.

## Feature (approved scope)

1. **Hue filter strip**: 13 always-visible swatches in the gallery filter bar — 12 hue groups (30° buckets) + 1 neutral. Click filters the gallery to that group; click again clears. Single-select.
2. **Rainbow sort**: a 5th state in the existing sort cycle (Name↑ → Name↓ → ID↑ → ID↓ → **Rainbow**) ordering images by hue group ascending (red → pink), most-saturated first within a group, neutrals last.

Out of scope (possible follow-ups): "Color pop" / "Minimalist" sorts, clickable palette swatches in the detail sidebar.

## Architecture decision

The gallery is server-paginated (50/page), so filtering and sorting live in the **daemon**. Hue group is **computed on the fly** from the stored palette via the existing in-memory filter path in `imageStore.GetAll` (same path as `colors_near` / `palette_similar_to`) — no schema change, no migration, works retroactively. Rejected: stored `hue_group` DB field (needs backfill + sync burden, no perf win at collection scale); client-only (breaks across pages).

## Hue bucketing

`HueGroupFromPalette(swatches []string) int` in `daemon/internal/cielab`:

- Walk swatches in stored order (dominance order — most dominant first).
- Convert hex → RGB → HSL. A swatch is **chromatic** when `saturation ≥ 0.18` and `0.12 ≤ lightness ≤ 0.92`.
- First chromatic swatch wins: bucket its hue red-centered — hue ≥ 345° or < 15° → group 0 (red); each subsequent 30° → groups 1–11.
- No chromatic swatch → group **99** (neutral). Invalid hexes are skipped.

This beats skwd-wall's 1×1-average approach: a red-and-blue wallpaper lands in its dominant color's group instead of a fictional purple.

Group centers (for UI swatch colors): group k = hue `k*30°`; neutral = gray.

## API surface

`GET /images` (daemon Unix socket):

- New query param `hue_group` (int: 0–11 or 99; anything else → 400 `invalid hue_group`).
- `sort_by` accepts new value `hue`. Rainbow order: hue group asc (`sort_order=desc` reverses group order), neutral group always last, saturation of the dominant chromatic swatch desc within a group, `imported_at` desc as final tie-break. When `sort_by=hue`, the DB pre-sort is pinned to `imported_at` desc and real ordering happens in memory.
- Both trigger the in-memory filter path. Documented in `daemon/API_CONTRACT.md`.

## Client

- `Filters` gains `hueGroup: number | null` (persisted; sanitized on load) and `type` union gains `"hue"`.
- `mapFiltersToImageQueryParams` emits `hue_group` and `sort_by: "hue"`; `galleryHasActiveFilters` counts an active hue filter; the search-bar "clear all" also clears it.
- `useFilteredImages` preserves server order for `type === "hue"` (like `"id"`).
- New `src/components/HueFilterStrip.tsx` rendered in the filter bar's pill group: 13 round swatch buttons, `hsl(k*30 65% 45%)` fills (+ gray neutral), selected swatch gets primary ring + slight scale, `aria-pressed`/`aria-label`s, DaisyUI/theme-variable styling (works in modern + neobrutalist designs; no canvas skew).
- Sort button label for the new state: **Rainbow**.

## Testing

- Go: `cielab` unit tests (red wrap-around, dominance order, neutral threshold, invalid/empty palettes); store `GetAll` tests for `HueGroup` filtering and `sort_by=hue` ordering (modeled on `TestImageStore_GetAll_ColorsNear`); handler param validation.
- Vitest: param mapping, storage sanitization, sort-cycle behavior.
- Gates: `pnpm run ci:check`, `pnpm run test:daemon:unit`.

## Execution

Branch `feat/hue-filter-rainbow-sort` in an isolated worktree (`.worktrees/waypaper-engine-hue`) to avoid conflicts with concurrent documentation work in the main checkout. Subagent-driven development (Sonnet workers), plan at `docs/superpowers/plans/2026-07-09-hue-filter-rainbow-sort.md`.
