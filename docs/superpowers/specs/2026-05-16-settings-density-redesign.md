# Settings Modal Density & Readability Pass

**Date:** 2026-05-16
**Status:** Approved (brainstorm)
**Scope:** waypaper-engine renderer — `src/components/settings/**`

## Problem

Even after the foundation slice swept the descriptive copy:

- `SettingSectionHeader` title uses `text-base-content/40` — sections like "Theme & Appearance" / "Design System" render as faint ghost text in the screenshot.
- `SettingsTabs` left-rail inactive labels use `text-base-content/60` — sidebar items look disabled.
- `SettingsSearch` result rows use `text-[10px]` for the path chip and description, plus `/40`–`/60` opacity — unusable on most themes.
- `SettingsModal` header uses `text-sm` title and `/50` opacity icons — header reads weaker than the body content under it.
- Section padding is responsive (`pt-6 xl:pt-8`, `py-4 xl:py-5`) but the modal panel is capped at `min(1100px, 92vw)` — `xl:` breakpoints rarely trigger because the panel width is below the Tailwind `xl` viewport breakpoint. The xl- ramps are dead code in practice.

## Goals

1. Section headers and tab labels read as real text, not ghost text.
2. Search results use the body type scale, not a quarter-size override.
3. Modal header out-weights the body content (title > section labels > body text).
4. Strip dead `xl:` size ramps from `SettingRow` / `SettingSectionHeader`; the global UI Scale setting now covers what those were trying to do.

## Non-Goals

- Re-architecting the tab layout / search input.
- Redesigning individual setting controls (toggles, dropdowns).
- Touching the Backend / Daemon / Wallhaven section *contents*. Style tokens only.

## Design

### 1. Token sweep

| File | Was | Now |
|---|---|---|
| `SettingRow.tsx` SectionHeader title | `text-xs xl:text-sm uppercase tracking-wider text-base-content/40` | `text-xs uppercase tracking-wider` w/ `color: var(--wp-text-muted)` |
| `SettingRow.tsx` SettingRow label | `text-sm xl:text-base font-medium` | `text-sm font-medium` (UI Scale handles size) |
| `SettingRow.tsx` SettingRow description | `text-xs xl:text-sm` | `text-sm` w/ `--wp-text-muted` |
| `SettingsTabs.tsx` inactive link/tab | `text-base-content/60` | `color: var(--wp-text-muted)` |
| `SettingsTabs.tsx` nav icon `opacity-70` | inline | drop — icon inherits link color which is already muted when inactive |
| `SettingsSearch.tsx` path chip | `text-[10px] text-base-content/60` | `text-xs` w/ `--wp-text-muted`, bg `--wp-surface-2` |
| `SettingsSearch.tsx` description | `text-[10px] text-base-content/50` | `text-xs` w/ `--wp-text-faint` |
| `SettingsSearch.tsx` search icon | `text-base-content/40` | `color: var(--wp-text-faint)` |
| `SettingsSearch.tsx` clear hover | `hover:text-base-content/60` | `hover:text-base-content` |
| `SettingsModal.tsx` title | `text-sm font-semibold tracking-wide` | `text-base font-semibold` (no extra tracking) |
| `SettingsModal.tsx` header icon | `text-base-content/50` | `color: var(--wp-text-muted)` |
| `SettingsModal.tsx` close btn | `text-base-content/50` | `color: var(--wp-text-muted)`, hover `text-base-content` |

### 2. Drop dead breakpoint ramps

`xl:` Tailwind variants in `SettingRow` and `SettingSectionHeader` (`xl:text-base`, `xl:text-sm`, `xl:py-5`, `xl:pt-8`, `xl:pb-3`) are removed. The modal panel is capped at 1100px, below the `xl` viewport breakpoint of 1280px, so these never apply. Users who want larger UI now use the UI Scale setting, which scales `font-size` on `:root` and therefore propagates to every `rem`-based padding / font-size in the modal.

Result: smaller, cleaner classes; layout is now deterministic across viewports.

### 3. Header weight

Modal header height stays at `h-12`. Title bumps from `text-sm` → `text-base font-semibold`. Section headers stay at `text-xs uppercase muted`. Body labels stay at `text-sm`. Result is a clean ramp:

```
base    Settings                (modal title)
xs UPPER  THEME & APPEARANCE   (section header)
sm       Application Theme     (row label)
sm       Choose the visual…    (row description, muted)
```

## Acceptance

- No remaining `text-[10px]`, `text-base-content/40`, `text-base-content/50`, `text-base-content/60` literals under `src/components/settings/`.
- No remaining `xl:` size or padding ramps in `SettingRow.tsx`.
- Visual hierarchy: header title > section header > row label > description, on every bundled theme.
- All renderer tests pass.

## Risks

- **Removing `xl:` ramps**. Theoretically a future redesign might widen the panel past 1280px and rely on those. Acceptable; can reintroduce on a real widening — current code is dead.
- **Tab inactive contrast**. Bumping inactive nav from `/60` to `--wp-text-muted` (0.72) may visually reduce the active/inactive contrast. Compensate by making the active state heavier (`font-semibold`) instead of relying on opacity differential. Verify per theme.

## Out of scope (next specs)

- Wallhaven route maturity.
- History route.
