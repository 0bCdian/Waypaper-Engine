# Image Details Sidebar Redesign

**Date:** 2026-05-16
**Status:** Approved (brainstorm)
**Scope:** waypaper-engine renderer — `src/components/ImageDetailSidebar.tsx`

## Problem

- Body text is `text-xs` everywhere; helper / palette intro is `text-[10px]`. Under most themes this falls below readable.
- Palette swatch delete affordance is a floating 20px `×` bubble outside the swatch corner — visually larger than the swatch chip in proportion, distracting, and reads as a separate badge rather than an action on the swatch.
- Metadata block is bare `<p>` lines (`ID:`, `WxH`, `FORMAT · SIZE`) with no hierarchy.
- Several ad-hoc `text-base-content/40 | /45 | /55` references survived the foundation sweep (web wallpaper section, empty-tags hint, palette `+` button).
- The Save button sits at the bottom of a scrollable column — users must scroll past the tag input to find it.
- Header `Image Details` uses the same small uppercase style as section labels, flattening the visual hierarchy.

## Goals

1. Readable type scale across the entire sidebar, using foundation tokens.
2. Palette swatch with a delete affordance that reads as part of the swatch, not a floating bubble.
3. Metadata laid out as a structured key/value list with clear hierarchy.
4. Save action always reachable (sticky footer).
5. Wipe out remaining ad-hoc opacity classes in this file.

## Non-Goals

- Redesigning the color picker popover itself (works fine).
- Touching the web wallpaper config form's behaviour. Type-scale and token sweep only.
- Adding new features (bulk delete, drag-reorder swatches, etc.).

## Design

### 1. Type scale pass

| Region | Was | Now |
|---|---|---|
| Sidebar header `Image Details` | `text-sm uppercase` | `text-base font-semibold` (no uppercase) |
| Section labels (`Name`, `Palette`, `Tags`, `Web wallpaper`) | `text-xs uppercase tracking-wide muted` | keep `text-xs uppercase tracking-wide`, color `--wp-text-muted` — labels are role-correct |
| Body / metadata / inputs | `text-xs` | `text-sm` |
| Helper lines (palette intro, web caps note) | `text-[10px]` / `text-[11px]` | `text-xs` w/ `--wp-text-muted` |
| Empty-state hints (no tags yet, no schema) | `text-xs text-base-content/40` | `text-xs` w/ `--wp-text-faint` |
| Save-failed note | `text-[10px] text-error` | `text-xs text-error` |

All `text-base-content/<n>` in this file replaced with `var(--wp-text-muted)` (paragraphs, labels) or `var(--wp-text-faint)` (hints/disabled placeholders).

### 2. Palette swatch & delete affordance

Current: 32px swatch with floating 20px `×` at `-right-1.5 -top-1.5`.

New:

- Swatch chip stays 32px (size-8). No floating bubble.
- Delete is an inset corner: a 12px (`size-3`) circle at the bottom-right *inside* the swatch, with `backdrop-filter: blur(2px)` + `background: oklch(0 0 0 / 0.35)` + white `×` glyph at `9px`. Hidden by default; revealed on hover/focus of the swatch group, with a `group-hover:opacity-100 transition` of 120ms.
- Hit target: the inset button is small visually but extends a 24px transparent pseudo-element via `::after` for usable pointer area without expanding the visual footprint.
- Alternative keyboard path: when swatch has focus, `Delete` / `Backspace` removes it (new keydown handler on the swatch button — focus must already be on it, no global capture).

Result: the swatch reads as one object. The chrome appears only when the user is already interacting with that chip.

### 3. Metadata block

Current:

```
ID: 5
1920 × 1080
PNG · 1.2 MB
```

New: definition-list grid, two columns, label on the left at `--wp-text-faint`, value on the right at default foreground:

```
ID         5
Dimensions 1920 × 1080
Format     PNG
Size       1.2 MB
```

CSS via `<dl className="grid grid-cols-[5rem_1fr] gap-x-3 gap-y-1 text-sm">`. Labels are `<dt className="text-xs uppercase tracking-wide" style={{color: 'var(--wp-text-faint)'}}>`, values `<dd>` default.

### 4. Sticky save footer

Move the `Save details` button out of the scroll container into a sticky footer (`shrink-0 border-t border-base-300 px-4 py-3 bg-base-200`). Button keeps its `disabled={!hasChanges}` logic. The body content above shrinks to fill remaining height; scroll happens within the body, not the whole sidebar.

The "Open in Loop Studio" button stays in the body (it's media-conditional, not an "apply changes" action).

### 5. Header

- Title becomes `text-base font-semibold` (no uppercase).
- Close button kept right-aligned.
- Bottom border keeps the section divider.

### 6. Web wallpaper config form

Same type-scale pass:

- Section heading: `text-xs uppercase tracking-wide` w/ `--wp-text-muted` (unchanged structurally, just the muted token).
- Labels: `text-xs uppercase tracking-wide` muted.
- Help paragraphs: `text-xs` muted (was `text-xs`/`text-[10px]` mix).
- Inline `<code>` keeps `text-xs` but inherits `font-mono` (drop the `text-[10px]` override).
- The `text-base-content/45` "Enable global HTML network…" note becomes `text-xs` faint.

No structural changes — purely token + size sweep.

## Acceptance

- No `text-[10px]` / `text-[11px]` / `text-base-content/<n>` literals remain in `ImageDetailSidebar.tsx`.
- Palette swatches have no floating outside-corner bubble. Hovering a swatch reveals an inset delete glyph that removes it on click; focus + Delete also removes it.
- Metadata is a 2-column key/value list.
- Save button stays visible at the bottom of the sidebar regardless of scroll position.
- All renderer tests pass (`pnpm test`).
- `pnpm run audit:contrast` ratios for `wp-text-muted` / `wp-text-faint` on this sidebar's `base-200` background match the global numbers (audit script is theme-level — no new pairs needed).

## Risks

- **Sticky footer + scroll body change**. Existing layout uses `flex flex-1 flex-col gap-4 overflow-y-auto p-4` on the body container with the button inside it. Switch to `flex flex-col flex-1 min-h-0` outer, scroll inner. Verify no overflow regressions at narrow widths (`w-full lg:w-[min(32rem,...)]`).
- **Inset delete hit target**. Pseudo-element-based hit zone is unconventional; if pointer events on `::after` give trouble, fall back to a wrapper `<div className="relative">` with a transparent overlay element. Decided at implementation.
- **Keyboard delete on swatch**. Must not steal Backspace when the user is somewhere else. Handler is bound only to the swatch button element — no global listener.

## Out of scope (next specs)

- Settings modal density pass.
- Wallhaven route maturity.
- History route.
