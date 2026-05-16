# Wallhaven Phase B — Polish & Discovery

**Date:** 2026-05-16
**Status:** Approved (brainstorm)
**Scope:** waypaper-engine renderer — `src/routes/Wallhaven.tsx`, `src/stores/wallhavenStore.ts`, `src/components/settings/sections/WallhavenSettingsSection.tsx`, daemon Wallhaven client, `src/styles/tokens.css`

## Problem

After Phase A (parity), Wallhaven still lacks:

1. **No quick visual preview.** Users must click into the detail modal to see a larger image.
2. **Tags in the detail modal are static.** Clicking a tag has no effect; no way to discover similar wallpapers cheaply.
3. **No resolution suitability indicator.** Users guess whether a thumbnail at 1920×1080 fits their 3440×1440 monitor.
4. **No aspect-ratio filter.** Mixed orientations dominate results; ultrawide users have to scroll past portrait images.
5. **No color filter.** Wallhaven's `colors` API param is unused.
6. **No "in gallery" awareness.** Re-downloading a wallpaper already in the gallery is silent.
7. **NSFW thumbnails always visible.** Risky on screen-share / shoulder-surfing scenarios.

## Goals

1. Long-hover preview popover with the large thumbnail.
2. Clickable tag chips in the detail modal that append a `#tag` to the active query.
3. Resolution-match badge on every card (4 states).
4. Aspect-ratio filter as a grouped chip set in the toolbar.
5. Color filter using Wallhaven's predefined palette.
6. Passive "in gallery" badge + optional hide toggle for already-downloaded wallpapers.
7. NSFW thumbnails blurred by default with hover-to-reveal; one settings toggle to disable.

## Non-Goals

- Saved searches.
- Bulk "import as playlist".
- Tag autocomplete in the search input.
- Server-side color-similarity sort.
- Multi-color filter (API supports one color).

## Design

### 1. Hover preview popover (item 11)

After **300 ms** of pointer dwell on a card, render a portaled popover anchored to the card showing `wp.thumbs.large` (≈ 1280px wide). The popover is **passive**: `pointer-events: none`, so the card's existing Set / Download hover buttons remain clickable through it.

Sizing:
- `max-width: min(720px, 60vw)`, `max-height: 80vh`.
- Maintains the thumbnail's natural aspect ratio (`object-fit: contain`).
- `border: var(--wp-border-w) solid var(--wp-border-color); border-radius: var(--wp-radius-md); box-shadow: var(--wp-elev-3); background: var(--color-base-100);`.

Position: above the card by default; if `card.top - popoverHeight < 12px`, flip below. Horizontal: anchored to card center, clamped 12px from viewport edges. Reuse the `clampPalettePopoverPosition` pattern from `ImageDetailSidebar`.

Fade in `opacity 0 → 1` over 120ms after the 300ms dwell. Cancel + dismiss on `pointer-leave` immediately.

State scoped to the card component: `hoverDwell` timer + `previewOpen` boolean. No global state.

Skip preview if the user has Reduce Motion preference (`prefers-reduced-motion: reduce`) — fall back to no preview.

### 2. Clickable tag chips (item 12)

In `WallhavenDetailModal`, each tag chip becomes a `<button>`. On click:

1. Read current `filters.query`.
2. If `#tagname` is **not** already present (case-insensitive substring check against `#tagname` token boundaries): append `" #tagname"` (with leading space if query non-empty).
3. Call `setQuery(newQuery)`, close the detail modal (`onClose()`), then `setPage(1)` + `search()`.

Visual treatment: tag chips gain hover styles (`hover:bg-primary/10 hover:border-primary cursor-pointer`). Keep the same `badge-xs badge-outline` base so the rest of the layout doesn't shift.

The `+N more` badge (shown when there are >10 tags) becomes a button that toggles full tag list display in the modal — wires into Phase A's "expandable tags" pattern.

### 3. Resolution-match badge (item 14)

Reference monitor: the largest monitor from `useMonitorStore().monitorsList` — chosen by max `width * height`. If `monitorsList.length === 0`, hide the badge.

Match states (computed from `wp.resolution` parsed as `WxH`):

| State | Condition | Color (DaisyUI) |
|---|---|---|
| `Exact` | `wpW >= monW` AND `wpH >= monH` AND aspect-ratio delta ≤ 2% | `badge-success` |
| `Good` | `wpW >= monW` AND `wpH >= monH` AND aspect-ratio delta > 2% | `badge-neutral` |
| `Upscale Nx` | `wpW < monW` OR `wpH < monH` | `badge-warning` (label shows the scaling factor, e.g. `Upscale 1.4×`) |
| `Crop` | Aspect-ratio delta > 25% (heavy crop regardless of size) | `badge-warning` |

Aspect-ratio delta = `abs(wpAR - monAR) / monAR`.

Where displayed: in the card resting footer strip (added in Phase A maturity pass), prepended before `resolution · category`. In the detail modal, as a chip in the metadata grid.

Helper `computeResolutionMatch(wpResolution, monitor)` lives in a new `src/utils/wallhavenResolutionMatch.ts` with unit tests covering each branch.

### 4. Aspect-ratio filter (item 15)

Add `ratios: string[]` to `WallhavenFilters` in `wallhavenStore.ts`. Default empty (no filter).

Chip groups in toolbar row B (after Purity, before Sort):

| Chip | Underlying API ratios |
|---|---|
| Wide | `16x9,16x10` |
| Ultrawide | `21x9,32x9,48x9` |
| Portrait | `9x16,10x16` |
| Square | `1x1,3x2,4x3,5x4` |

Multi-select. When the user picks Wide + Ultrawide, the resulting `ratios` API param is `16x9,16x10,21x9,32x9,48x9`.

Wire through:
- `wallhavenStore.search()` includes the ratios in the request.
- Daemon's wallhaven client passes `ratios` query param (TBD — verify in `daemon/internal/wallhaven/`). If the daemon doesn't currently accept it, extend the request type. Owners: wallhaven service + types regen.

UI: same chip pattern as Category/Purity, grouped under a `Ratio` label.

### 5. Color filter (item 16)

Add `color: string | null` to `WallhavenFilters` (single color — API limit). Send as `colors` API param without leading `#`.

The Wallhaven palette has 30 fixed colors. Hard-code them as a constant `WALLHAVEN_PALETTE` in `wallhavenStore.ts` (or a small `wallhavenPalette.ts` util — your call). Values from the public Wallhaven search page: `660000, 990000, cc0000, cc3333, ea4c88, 993399, 663399, 333399, 0066cc, 0099cc, 66cccc, 77cc33, 669900, 336600, 666600, 999900, cccc33, cccc99, 996633, 663300, 996600, cc9966, ffcc99, ffffff, cccccc, 999999, 666666, 333333, 000000` (count varies — copy from the live page during impl).

UI: a "Color" group at the end of toolbar row B. Trigger button shows either:
- An "Add color" outlined swatch icon, OR
- The currently active swatch with a small `×` to clear.

Click opens a popover (portaled, same pattern as the Set popover from Phase A) containing the palette as a grid (e.g. 6 cols × 5 rows of `size-6` swatches). Click a swatch → `setColor(hex)`, close popover, run search.

### 6. Hide-already-downloaded (item 17)

Detection: a localStorage-backed `Set<string>` of wallhaven IDs. Persisted under key `wallhaven-downloaded-ids`. On `downloadToGallery` success, add `wp.id` to the set. On `downloadImportAndSet` success too.

Renderer-side state shape in `wallhavenStore`:
```ts
downloadedIds: Set<string>;
hideDownloaded: boolean;  // toolbar toggle, default false
addDownloadedId: (id: string) => void;
setHideDownloaded: (v: boolean) => void;
```

Visual:
- **Default (passive)**: cards whose `wp.id` is in `downloadedIds` render at `opacity-65` and show a small chip in the top-right reading `In gallery` (checkmark + label) with `badge-xs badge-success`. Always visible, not hover-gated.
- **Hide toggle ON**: those cards are filtered out of `displayResults`. Toggle lives at the end of toolbar row A (next to the scroll-mode segmented control).

Bonus: when a download finishes, the card animates the `In gallery` chip in (no full re-render) — same component re-renders on `downloadedIds` change.

### 7. NSFW blur until hover (item 19)

Apply only to `wp.purity === "nsfw"` cards. Sketchy is untouched.

State:
- New setting in `WallhavenConfig` (daemon-side, persistent): `blur_nsfw_thumbnails: boolean`, default `true`. Surfaced in Settings → Wallhaven as a toggle "Blur NSFW thumbnails".
- Renderer reads via `useSettingsStore`.

Behavior:
- Each NSFW card's `<img>` gets `filter: blur(24px); transition: filter 200ms ease-out;`.
- On pointer hover **of the card**, the filter drops to `blur(0)`. On leave, returns.
- The card's hover overlay buttons (Set / Download) remain interactive when the user hovers the card — same group hover trigger.
- A small `NSFW` chip is always visible in the top-right of NSFW cards regardless of blur state (red `badge-error badge-xs`).
- Keyboard: when the card has focus (Tab), blur drops too (focus-within selector).

If `blur_nsfw_thumbnails` is false: no blur applied, NSFW chip still shows.

Detail modal: never blurred (user has already clicked through to it).

## Acceptance

1. Hovering a card ≥ 300ms shows a popover with the large thumbnail; the popover doesn't intercept clicks on the card's action buttons.
2. Tag chips in detail modal are clickable; clicking appends `#tag` to the query, closes the modal, runs search.
3. Each card shows a resolution-match badge with one of four states; computed against the largest monitor.
4. Toolbar row B has Ratio chip group (4 options, multi-select); search results respect the filter.
5. Toolbar row B has a Color trigger; clicking opens a palette popover; picking a swatch filters results.
6. Cards already in the gallery render dimmed with an `In gallery` badge; a toolbar toggle fully hides them.
7. NSFW cards render blurred by default; hovering or focusing reveals the image; setting `blur_nsfw_thumbnails: false` disables the blur.
8. `pnpm test` passes (including unit tests for `computeResolutionMatch`).

## Risks

- **Daemon `ratios` plumbing**. If the daemon-side wallhaven client doesn't accept `ratios`, the filter chips become dead UI. Implementation must verify and extend; otherwise the spec ships a broken feature. Owner: agent to check `daemon/internal/wallhaven/` before wiring the renderer side.
- **`colors` palette drift**. Wallhaven's palette is not part of the public API; we hard-code values from the search page. If they change it, the active swatch may stop matching server-side results. Mitigation: pull values once during implementation; document the source.
- **Resolution badge accuracy at scaling**. Some monitors report logical (post-scale) resolution; users on HiDPI may see `Upscale` when their effective pixels are actually fine. Acceptable trade — we badge based on what the daemon reports.
- **localStorage hide-downloaded persistence**. Lost on a fresh install. Acceptable per Q7a.
- **Popover stacking with NSFW blur**. The hover preview popover renders the large thumb unblurred — that's a privacy hole if NSFW blur is on. Mitigation: preview popover applies the same blur if `wp.purity === "nsfw"` and `blur_nsfw_thumbnails === true`. The user must explicitly mouse-over the card *and* its underlying image to unblur the preview as well. Document this in code.

## Out of scope

- Saved searches.
- Bulk import as playlist.
- Color-similarity sort.
