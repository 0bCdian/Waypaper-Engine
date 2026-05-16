# Wallhaven Route Maturity Pass

**Date:** 2026-05-16
**Status:** Approved (brainstorm)
**Scope:** waypaper-engine renderer — `src/routes/Wallhaven.tsx`

## Problem

The Wallhaven page implements browsing, filtering, selecting, and downloading correctly, but visually reads as a prototype:

- Toolbar crams search, category, purity, sort, and scroll-mode toggle into a single wrapping row with no visual hierarchy. Filter labels (`Category:`, `Purity:`) only show at `lg:` widths, so at narrow viewports the filter chips lose their meaning.
- Cards show no information at rest — resolution, category, and the download button only appear on hover. New users don't know what they're looking at without mousing over every tile.
- Empty / error states are bare text in muted opacity (`text-base-content/40`). Both the "Wallhaven is disabled" splash and "No results" string use a single small line with no visual anchor.
- Detail modal footer crams metadata, colors, tags, and three actions in an unbalanced row that wraps awkwardly.
- Selection bar reserves layout space (good — no shift) but its colors (`bg-primary/10 border-primary/20`) read as a thin pastel ribbon rather than a confident "you have N selected, here's what you can do" surface.
- No "back to top" in infinite-scroll mode.
- No indication of the active filter set as a single glanceable summary (you have to read each chip).

## Goals

1. Toolbar with a clear two-row rhythm: search prominent on top, filter chips with explicit grouping below.
2. Cards that communicate at rest (resolution + a 1-line meta strip) and surface actions on hover.
3. Empty / disabled / error states with a real visual anchor (icon + heading + body + primary CTA).
4. Detail modal: balanced footer with metadata in a grid, colors as proper swatches, primary action obvious.
5. Active-selection bar that reads as a real action bar, not a tinted strip.
6. "Back to top" button in infinite-scroll mode after scrolling past one viewport height.

## Non-Goals

- Saved searches / search history (scope creep).
- Adding new filter types (resolution range, aspect ratio, etc.).
- Touching the wallhaven store (state shape stays).
- Authentication / API key UX (lives in Settings → Wallhaven, that's a separate flow).
- Replacing the existing context menu (works, leave it).

## Design

### 1. Toolbar restructure

Replace the single wrap-row with a two-row layout regardless of viewport width:

**Row A** (full width):
- Search input — flex-1, larger (`input-md` not `input-sm`).
- Search button — primary.
- Scroll-mode toggle — small icon button on the right, paginated/infinite shown as a two-segment toggle (not a single-button toggle that flips label).

**Row B** (full width, divided into labeled groups):
- `Category` group: explicit label + 3 chips (General / Anime / People). Label always visible (drop the `hidden lg:inline`).
- `Purity` group: explicit label + chips. NSFW chip only when `hasApiKey`.
- `Sort` group: label + select.

Visually each group is wrapped in a `wp-card`-style mini surface or separated by vertical hairlines (`--wp-hairline`). One pick: vertical hairlines — lighter, doesn't bulk the toolbar.

### 2. Card resting state

Currently the card is just the image; meta + actions appear on hover only.

New resting state: image fills the card; a 1-line footer strip pinned to the bottom shows `resolution · category` in `text-xs` with `--wp-text-muted` color on a `--wp-surface-2` background. No hover required.

On hover: the gradient + download button overlay still appear, slightly more compact. Purity badge stays a hover-only chip in the top-right.

Selected state stays the same (primary ring + checkmark in top-left).

### 3. Empty / disabled / error states

Replace the bare svg + paragraph pair with a structured block:

```
<div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
  <Icon ... className="size-12" style={{ color: 'var(--wp-text-faint)' }} />
  <h3 className="text-base font-semibold">{title}</h3>
  <p className="text-sm max-w-md" style={{ color: 'var(--wp-text-muted)' }}>{body}</p>
  {cta}
</div>
```

Three concrete variants:

- **Disabled** (already exists): title "Wallhaven is disabled", body "Enable it in Settings → Wallhaven to browse wallpapers.", CTA = a primary button "Open Wallhaven settings".
- **No results**: title "No wallpapers found", body "Try a different search term or relax the category/purity filters.", CTA = a ghost button "Reset filters" (clears query + resets categories + purity to defaults).
- **Error**: title "Couldn't reach Wallhaven", body = error message, CTA = "Retry".

### 4. Detail modal footer

Footer becomes a 12-column grid at `md+`:

- **Left 8 cols**: stacked metadata:
  - Row 1: `<h3>` with file name (or `Wallhaven #{id}`) — `text-base font-semibold`.
  - Row 2: definition list w/ Resolution, Size, Format, Uploaded (if present), Favorites, Views. 4 columns of label/value pairs at `text-sm`.
  - Row 3: Colors (label "Colors" muted + swatches, swatches `size-6` not `size-4`).
  - Row 4: Tags (chips, max 10 visible + `+N more` that expands on click rather than just showing a counter badge).
- **Right 4 cols**: action stack top-down — primary `Download to Gallery` (large), secondary `Open on Wallhaven` (link), tertiary `Close` ghost.

At narrow widths the right column collapses below the left.

### 5. Selection bar

Becomes a confident strip:

- Always-reserved height (`py-2`) but **explicit** — not transparent collapse.
- When selection present: bg `--wp-surface-2`, left-border accent (`border-l-4 border-primary`), text `text-sm font-medium`, with the count rendered as `<strong>N</strong> selected`.
- Actions: primary `Download N to Gallery` + ghost `Clear`. (Same actions as today.)
- When empty: 1 line of helper hint at `--wp-text-faint` — "Ctrl-click a wallpaper to start a selection, or Ctrl-A to select all." Replaces invisible placeholder.

### 6. Back-to-top in infinite mode

When `scrollMode === "infinite"` AND `scrollContainerRef.current.scrollTop > clientHeight`, render a floating button bottom-right (`absolute right-4 bottom-4`) — circular, `bg-base-200`, `border` + `shadow-[var(--wp-elev-2)]`, contains an up-chevron. Clicking scrolls the container smoothly to top.

Use a `useEffect` that subscribes to the scroll container's `scroll` event with `requestAnimationFrame` throttling; set local `showBackToTop` state. Cleaned on unmount.

### 7. Token sweep

In this file, replace remaining ad-hoc opacity / literal color refs:

- `text-base-content/40` (empty results, modal disabled hint) → `--wp-text-faint`.
- `text-base-content/10` borders → `--wp-hairline`.
- `text-base-content/20` swatch border → `--wp-border-color`.
- `text-white/70 | /80` (on hover gradient, fine — they sit on a dark gradient) — leave alone.
- `bg-primary/10 border-primary/20` selection bar → keep accent but per spec section 5.

## Acceptance

- Toolbar shows search prominently and filter chip groups with labels always visible.
- Each card shows resolution + category at rest without hover.
- Disabled, no-results, and error states render with icon + heading + body + CTA.
- Detail modal footer renders metadata in a grid; actions stack on the right.
- Selection bar shows a hint when empty, reads as a real action bar when selection > 0.
- Back-to-top button appears in infinite mode after one viewport scroll; clicking returns to top smoothly.
- No `text-base-content/<n>` literals remain in `Wallhaven.tsx`.
- Renderer tests pass.

## Risks

- **Filter chip group separators**. Vertical hairlines look fine in default mode but can be loud under neobrutalist (which already uses heavy borders). Mitigation: in `[data-design="neobrutalist"]`, drop the hairlines and rely on group spacing alone.
- **Card resting footer**. Adds visible chrome to every tile; some users prefer pure-image grids. Acceptable trade — the user explicitly said "feels half-baked", and information at rest is the fix. Not making it configurable in this slice.
- **Reset Filters CTA semantics**. Must not also clear query string — leave query, only reset categories + purity + sort. Decided to preserve query.

## Out of scope (next specs)

- History route maturity.
- Saved / recent searches.
- New filter types.
