# Readability & Density Foundation

**Date:** 2026-05-16
**Status:** Approved (brainstorm)
**Scope:** waypaper-engine renderer

## Problem

The engine's custom themes routinely produce low-contrast text:

- Settings modal section descriptions and sub-labels render at ~55–60% foreground opacity — below WCAG 4.5:1 on several palettes (visible in `Image #2`).
- DaisyUI `kbd kbd-sm` inside `alert-info` (`LoopStudio.tsx:859`, Shader Studio counterpart) renders as dark-on-dark — the kbd uses `base-300` while the alert tints the surface, collapsing contrast (visible in `Image #1`).
- Text size is not user-configurable. Users on HiDPI displays, accessibility users, and users who simply prefer larger UI have no recourse.
- "Muted" / secondary text is sprinkled as ad-hoc `opacity-60` or `text-base-content/60` rather than a token, so a global fix is impossible without a sweep.

This spec covers the cross-cutting foundation only. Image Details, Settings, Wallhaven, and History redesigns are explicitly deferred to follow-up specs that will build on this work.

## Goals

1. One global **UI Scale** setting that resizes the renderer typography from a single CSS var.
2. Two semantic muted-text tokens with a sane default opacity (0.72 / 0.55) replacing ad-hoc `opacity-60` usage.
3. A `<Kbd>` primitive that is readable on every surface, including inside alerts and the neobrutalist mode.
4. A dev-only contrast audit script (no CI gating) that flags theme × role-token pairs failing WCAG AA, so we can fix offenders incrementally.

## Non-Goals

- Per-theme overrides for muted opacity. Single global default.
- Per-component font-size overrides. Single global scale.
- Redesigning any specific surface (deferred).
- Migrating every existing `text-*` usage to the new role tokens in one PR. The role tokens are introduced and adopted in the surfaces that already have visible issues; broader migration is opportunistic (boy-scout) in subsequent specs.

## Design

### 1. UI Scale setting

Add a new General → Theme & Appearance entry **UI Scale** with four options:

| Label | `--wp-font-scale` |
|---|---|
| Compact | 0.9 |
| Default | 1.0 |
| Comfortable | 1.1 |
| Large | 1.25 |

Persistence: extend the existing app settings store (same place as the Typography font-family setting). Apply by setting `--wp-font-scale` on `:root` in the existing `ThemeContext`/equivalent that already manages `data-design` and theme class.

Role tokens added to `src/styles/tokens.css`:

```css
:root {
  --wp-font-scale: 1;
  --wp-text-xs:   calc(0.75rem  * var(--wp-font-scale));
  --wp-text-sm:   calc(0.875rem * var(--wp-font-scale));
  --wp-text-base: calc(1rem     * var(--wp-font-scale));
  --wp-text-lg:   calc(1.125rem * var(--wp-font-scale));
  --wp-text-xl:   calc(1.25rem  * var(--wp-font-scale));
  --wp-text-2xl:  calc(1.5rem   * var(--wp-font-scale));
}
```

No global `html { font-size: ... }` change — that would interact badly with rem-based DaisyUI internals. Components opt in to the scaled tokens via class or inline style. New code uses `var(--wp-text-*)`; existing components migrate as touched.

### 2. Muted text tokens

Added to `:root` in `tokens.css`:

```css
--wp-text-muted: oklch(from var(--color-base-content) l c h / 0.72);
--wp-text-faint: oklch(from var(--color-base-content) l c h / 0.55);
```

Rule of thumb:

- `--wp-text-muted` — labels, descriptions, paragraph-level secondary copy. Must remain readable.
- `--wp-text-faint` — hints, counts, placeholder-like helper bits. Never used for paragraph content.

Sweep targets (replace `opacity-60` / `/60` / `/50` / `text-base-content/70` patterns):

- `src/components/settings/**` — section descriptions, sub-labels.
- `src/components/ImageDetailSidebar.tsx` — palette helper line, file meta.
- `src/routes/LoopStudio.tsx` — tip line under section headers.
- `src/routes/Wallhaven.tsx` and `src/routes/History.tsx` — top-level helper copy.
- Gallery captions in `src/components/ImageCard.tsx` / `PaginatedGallery.tsx`.

Out of scope sweep: deeper-nested children. Boy-scout as encountered.

### 3. `<Kbd>` primitive

New file: `src/components/ui/Kbd.tsx`. Exported from `src/components/ui/index.ts`. API:

```tsx
<Kbd size="sm" | "md">I</Kbd>
```

Styling in `src/styles/tokens.css`:

```css
.wp-kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.5em;
  padding: 0 var(--wp-space-2);
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, monospace);
  font-size: var(--wp-text-xs);
  line-height: 1.6;
  background: var(--wp-surface-3);
  color: var(--color-base-content);
  border: var(--wp-border-w) solid var(--wp-border-color);
  border-radius: var(--wp-radius-sm);
  box-shadow: inset 0 -1px 0 var(--wp-hairline);
}
.wp-kbd--sm { font-size: calc(0.7rem * var(--wp-font-scale)); padding: 0 4px; }

[data-design="neobrutalist"] .wp-kbd {
  box-shadow: 2px 2px 0 0 #000;
  font-weight: 700;
  letter-spacing: 0.02em;
}

/* Containment: when inside a tinted alert, derive colors from currentColor
   so the kbd is always readable regardless of the alert hue. */
.alert .wp-kbd,
[class*="alert-"] .wp-kbd {
  background: oklch(from currentColor l c h / 0.18);
  color: currentColor;
  border-color: oklch(from currentColor l c h / 0.4);
  box-shadow: none;
}
```

Migration: replace every `<kbd className="kbd ...">` in `src/routes/LoopStudio.tsx` and the Shader Studio tip block with `<Kbd>`. Grep the full repo for `className="kbd` to catch stragglers.

### 4. Contrast audit script

New file: `scripts/audit-contrast.mjs`. Runnable via `pnpm run audit:contrast`.

Behavior:

1. Headlessly load `src/styles/themes/_index.ts` to enumerate themes.
2. For each theme, mount a hidden document with that theme applied (jsdom or Playwright headless — Playwright already present for e2e, prefer it for accurate CSS resolution).
3. For each combination of role-token foreground × surface background:
   - `base-content` on `base-100` (body)
   - `wp-text-muted` on `base-100` (muted body)
   - `wp-text-faint` on `base-100` (faint)
   - `base-content` on `wp-surface-2`, `wp-surface-3`
   - `wp-kbd` text/bg pair inside each alert variant (`alert-info|success|warning|error`)
4. Compute WCAG contrast ratio. Report table: `theme | pair | ratio | pass(>=4.5 body / >=3.0 large)`.
5. Exit code 0 always (dev-only — **no CI gating**). Output is human-readable table + a JSON file for diffing.

Not run in CI. Listed only in `package.json` `scripts`.

### Settings UI

The General → Theme & Appearance section gets one new collapsible card "UI Scale" with a segmented control (4 options). Persists via existing settings store. Live-applies — no reload.

## Acceptance

- `pnpm run audit:contrast` runs and produces a report.
- Loop Studio tip kbd row is readable on every theme (visually verifiable; audit script confirms `wp-kbd` pair ≥ 4.5:1 inside `alert-info` for all themes).
- Switching UI Scale changes visible text size in: settings modal labels/descriptions, gallery filenames, Loop Studio tip, image details fields. No layout breakage at any scale option on a 1080p window.
- Settings modal section descriptions and Image Details palette helper line render at the new muted token (visually heavier than before).
- No regression in existing unit tests (`pnpm run test:daemon` not affected; `pnpm test` for renderer passes).

## Risks

- **`oklch(from ...)` browser support.** Already used elsewhere in `tokens.css`, so the renderer's Electron Chromium covers it. No new risk.
- **Font scale interacting with DaisyUI components.** Mitigated by not touching root `font-size`; only `--wp-text-*` tokens scale. DaisyUI internals stay at their defaults.
- **Audit script flakiness with Playwright.** If the Playwright route is too heavy, fall back to a jsdom + `culori` (already a transitive dep candidate) computation using parsed CSS. Decision deferred to implementation.

## Out of scope (follow-up specs)

1. Image Details modal redesign (palette swatch delete affordance, text hierarchy).
2. Settings modal density pass.
3. Wallhaven route maturity (browse → curate).
4. History route — make it useful.
