# Wallhaven Card Parity (Phase A)

**Date:** 2026-05-16
**Status:** Approved (brainstorm)
**Scope:** waypaper-engine renderer — `src/routes/Wallhaven.tsx`, `src/utils/wallhavenContextMenuItems.ts`

## Problem

The Wallhaven card right-click menu already has full `buildWallpaperSubmenu` parity with gallery cards (per-monitor set, clone, extend) — but it is undiscoverable. The card hover overlay only surfaces a single cryptic `↓` button (download to gallery). The detail modal only offers `Download to Gallery` + `Open on Wallhaven` + `Close`. There is no visible "set this wallpaper on monitor X" action anywhere in the primary UI; users must right-click and find the submenu.

Also missing relative to gallery card menu:
- No "Add to current playlist" (gallery cards have it).
- `↓` glyph for the download button is small and ambiguous.

## Goals

1. Make per-monitor set discoverable from a card without right-click.
2. Make the detail modal expose set-on-monitor as a first-class action.
3. Add "Add to current playlist" to the wallhaven context menu, matching gallery parity.
4. Replace the `↓` glyph with a proper icon.

## Non-Goals

- Reworking `buildWallpaperSubmenu` (works fine, reused).
- Saved searches, hover preview, tag click-to-filter (Phase B).
- Touching the wallhaven store internals.

## Design

### 1. Card hover overlay — split action

Current overlay (`Wallhaven.tsx`): single primary button with `↓` glyph in the bottom-right corner; meta (resolution, category, purity) on the bottom-left.

New: a two-button action row in the bottom-right of the hover overlay:

- **Set** (primary, smaller — `btn-xs`). Behavior:
  - If `monitorsList.length === 1` or there is exactly one selected monitor: directly call `downloadImportAndSet(wp, "*", "clone")` (or the selected monitor's name with `individual`).
  - Otherwise: open a small popover anchored to the button with three sections:
    1. `Clone across all`
    2. `Extend across all`
    3. Per-monitor entries (`On HDMI-A-1`, `On DP-1`, …)
  - Closes on click outside or `Escape`.
- **Download** (icon-only ghost, `btn-xs btn-square`). Renders a proper SVG download icon (use the same icon set as gallery: `lucide`-style down-arrow-into-tray).

The bottom-left meta stays.

Popover implementation: portal to `document.body`, anchored via `getBoundingClientRect`. Same pattern as the palette popover in `ImageDetailSidebar`. Z-index above the card grid but below the wallpaper detail modal.

### 2. Detail modal action stack

Current right column has `Download to Gallery` (primary) → `Open on Wallhaven` (link) → `Close` (ghost).

New right column from top:
- **Set on…** — primary button. Opens the same popover as the card hover overlay's Set button. Performs `downloadImportAndSet`.
- **Download to Gallery** — secondary outline button.
- **Open on Wallhaven** — link.
- **Close** — ghost.

If `monitorsList.length === 0` (no monitors known yet): the Set button disables with tooltip "No monitors detected".

### 3. Context menu addition

In `buildWallhavenCardMenuItems`, after `Download to Gallery`, add:

```
{
  type: "action",
  label: "Add to current playlist",
  disabled: <no active playlist>,
  onClick: () => { /* download → push image_id to active playlist */ }
}
```

Implementation: download via `useWallhavenStore.getState().downloadToGallery(wp)` returns (or awaits) the imported gallery image id. Then `usePlaylistStore.getState().addImagesToPlaylist([id])`. If no active playlist, item is disabled.

Verify the store API: if `downloadToGallery` doesn't already return the new image id, extend it to do so (additive change, not breaking). If that requires touching the daemon path, descope to a follow-up — the disabled item can stay shown w/ tooltip.

### 4. Icon swap

`↓` text glyph → SVG `<DownloadIcon />` (lucide-style: tray with arrow down). 14px in `btn-xs`. Same icon used in gallery context where applicable; if no shared icon component, inline the SVG (consistent with other inline icons in `Wallhaven.tsx`).

### 5. Token sweep stragglers

Quick grep pass in `Wallhaven.tsx` for any `text-base-content/<n>` that survived the maturity-pass commit. Replace with `--wp-text-muted` / `--wp-text-faint`.

## Acceptance

- Hover any wallhaven card → see two buttons in bottom-right: Set + Download.
- 1-monitor user clicking Set: downloads + applies in one click.
- 2+-monitor user clicking Set: popover appears with Clone / Extend / per-monitor entries.
- Detail modal shows Set on… as primary action above Download to Gallery.
- Right-clicking a card shows "Add to current playlist" (disabled if no active playlist).
- Download icon is a proper SVG, not the `↓` glyph.
- All renderer tests pass.

## Risks

- **Popover placement near grid edges**. The card grid is dense and the overlay sits at the bottom-right; popover would clip the viewport. Use the same clamp pattern as the palette popover (`clampPalettePopoverPosition`). If it gets messy, fall back to opening a small modal centered on screen for >1 monitor case.
- **`downloadToGallery` return value**. If the store doesn't currently return the new image id (or expose it via a callback / promise), the Add-to-current-playlist item ships as disabled-with-tooltip and we file a follow-up. Decided at implementation.

## Out of scope (Phase B follow-up)

- Hover preview (long-hover large thumb).
- Clickable tag chips in detail modal.
- Resolution-match badge.
- Aspect-ratio chips.
- Color filter.
- Hide-already-downloaded toggle.
- NSFW blur until hover.
