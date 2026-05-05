# Design System Consolidation — Modern + Neobrutalist

**Status:** draft
**Date:** 2026-05-06
**Owner:** @diegomiguelp1996
**Scope:** waypaper-engine frontend (`src/`)

---

## 1. Problem

The frontend currently maintains two parallel mode-switching mechanisms:

1. A 1409-line `src/styles/neobrutalist.css` overlay scoped to `[data-design="neobrutalist"]`.
2. A `useIsNeo()` hook consumed in **31 component files** that branch className strings (and sometimes whole markup blocks) by mode.

The palette layer is also bloated: `src/index.css` is 975 lines, ~700 of which are inlined `@plugin "daisyui/theme"` blocks; `src/themes/themes.ts` enumerates 35 DaisyUI builtins + 19 customs (54 total). Several customs (notably `nord-light`) are loose approximations of their source palettes rather than faithful renderings. There are three competing scrollbar systems (`::-webkit-scrollbar`, `.theme-scrollbar`, plus DaisyUI defaults) and three theme-transition utility classes (`.theme-transition`, `-fast`, `-slow`, `.disable-transitions`, `.wp-theme-transition`) — only the last is actually used.

Adding the planned **80s Vibe** palette (Broadcast Midnight) and consolidating both modes into a coherent system is the trigger to clean this up.

## 2. Goals

1. **Two design modes** (`modern`, `neobrutalist`), differing only by token values plus a small set of structural primitives — no per-component conditionals for the common case.
2. **Orthogonal palettes**: any palette × any mode. Switching either dimension is one DOM attribute write, no React re-renders required.
3. **Extensible theme registry**: built-in palettes ship as one CSS file each, auto-registered. End-users add palettes by dropping CSS files into `~/.config/waypaper-engine/themes/*.css`.
4. **Curated initial built-in pool** of ~45 palettes (counting light/dark variants separately; down from 54), with each existing custom palette audited against its canonical source doc.
5. **Reduce `useIsNeo()` consumers from 31 → ~5** (only the genuinely-divergent primitives keep the hook).
6. **Tighten visual cohesion across pages, components, and modals** via shared primitives.

## 3. Non-Goals

- An in-app theme editor (the JSON-driven palette builder is a future feature; drop-in CSS unblocks 95% of the use case).
- Reworking the gallery layout or `ImageCard` markup beyond what the new primitives require.
- Backwards compatibility with the dropped DaisyUI builtins or dropped customs (waypaper-engine is rewrite-friendly per `CLAUDE.md`).
- Migrating Tauri/`wal-utauri` styling — out of scope; only `waypaper-engine/src/`.

## 4. Architecture

### 4.1 Three-layer cake

```
┌────────────────────────────────────────────────────────────┐
│ Layer 3 — Components & primitives                          │
│   pages/modals consume DaisyUI tokens + a small set of     │
│   waypaper primitives (Card, Modal, Button, IconButton,    │
│   Field, Surface). No isNeo branches in consumers.         │
├────────────────────────────────────────────────────────────┤
│ Layer 2 — Mode tokens (--wp-*)                             │
│   --wp-radius, --wp-border-w, --wp-shadow-offset,          │
│   --wp-shadow-color, --wp-display-case, --wp-display-      │
│   tracking, --wp-display-weight, --wp-paper-grid-*,        │
│   --font-display. Two value sets: :root (modern) and       │
│   [data-design="neobrutalist"] (neobrutalist).             │
├────────────────────────────────────────────────────────────┤
│ Layer 1 — Palette tokens (DaisyUI --color-*)               │
│   One CSS file per palette in src/styles/themes/.          │
│   Selected via [data-theme="..."]. Auto-registered.        │
└────────────────────────────────────────────────────────────┘
```

Switching design mode = one attribute change on `<html>` (`data-design`). Switching palette = one attribute change (`data-theme`). They compose freely; `--wp-*` tokens reference `--color-*` where they need to follow palette colors (e.g. `--wp-shadow-color: oklch(from var(--color-base-content) l c h)` in modern, but a hard `#000` in neobrutalist).

### 4.2 Mode tokens

Defined once in `src/styles/tokens.css`:

```css
/* Modern (default) */
:root {
  --wp-radius-sm: 6px;
  --wp-radius-md: 10px;
  --wp-radius-lg: 14px;
  --wp-radius-xl: 20px;

  --wp-border-w: 1px;
  --wp-border-color: oklch(from var(--color-base-content) l c h / 0.12);

  --wp-shadow-x: 0px;
  --wp-shadow-y: 1px;
  --wp-shadow-blur: 2px;
  --wp-shadow-color: oklch(0 0 0 / 0.06);
  --wp-elev-1: 0 1px 0 var(--wp-border-color), 0 1px 2px var(--wp-shadow-color);
  --wp-elev-2: 0 1px 0 var(--wp-border-color), 0 4px 12px oklch(0 0 0 / 0.06);
  --wp-elev-3: 0 1px 0 var(--wp-border-color), 0 12px 32px oklch(0 0 0 / 0.12);

  --wp-display-case: none;
  --wp-display-tracking: -0.01em;
  --wp-display-weight: 700;
  --font-display: "Space Grotesk Variable", "Space Grotesk", system-ui, sans-serif;

  --wp-paper-grid-size: 24px;
  --wp-paper-grid-alpha: 0.07;
  --wp-paper-grid-vignette: 1; /* 0|1 */
}

/* Neobrutalist overlay */
[data-design="neobrutalist"] {
  --wp-radius-sm: 0px;
  --wp-radius-md: 0px;
  --wp-radius-lg: 0px;
  --wp-radius-xl: 0px;

  --wp-border-w: 4px;
  --wp-border-color: oklch(from var(--color-base-content) l c h / 0.9);

  --wp-shadow-x: 8px;
  --wp-shadow-y: 8px;
  --wp-shadow-blur: 0px;
  --wp-shadow-color: #000;
  --wp-elev-1: var(--wp-shadow-x) var(--wp-shadow-y) 0 0 var(--wp-shadow-color);
  --wp-elev-2: calc(var(--wp-shadow-x) * 1.5) calc(var(--wp-shadow-y) * 1.5) 0 0 var(--wp-shadow-color);
  --wp-elev-3: calc(var(--wp-shadow-x) * 2) calc(var(--wp-shadow-y) * 2) 0 0 var(--wp-shadow-color);

  --wp-display-case: uppercase;
  --wp-display-tracking: 0.02em;
  --wp-display-weight: 800;
  --font-display: "Aldrich", "Space Grotesk Variable", system-ui, sans-serif;

  --wp-paper-grid-alpha: 0.10; /* slightly more pronounced */

  /* Neo-only knobs (already exist; preserved & exposed via settings) */
  --neo-shadow-x: 8px;
  --neo-shadow-y: 8px;
  --neo-border-w: 4px;
  --neo-radius: 0rem;
}
```

The user-tunable neobrutalist knobs (`--neo-shadow-x/y`, `--neo-border-w`, `--neo-radius`) remain in the existing `designSystemStore` and feed into the same `--wp-*` tokens via aliases.

### 4.3 Primitives

Five primitives live in `src/components/ui/`. They are the **only** components allowed to read `useIsNeo()` (or, preferably, structural CSS classes that switch markup via `:where([data-design="neobrutalist"]) &`).

| Primitive | Purpose | What changes per mode |
|---|---|---|
| `<Surface>` | Generic panel/section. | Border, radius, elevation tokens. No markup change. *(Pure CSS class.)* |
| `<Card>` | Image card / folder card / info card. | Polaroid frame in neo when `polaroidCards` flag is on (extra wrapper + paper-tint inset shadow). |
| `<Modal>` | Modal shell. | Striped header in neo (replaces current `ModalStripedHeader`); heavier border + offset shadow; backdrop blur dialed differently. |
| `<Button>` | Primary action. Wraps DaisyUI `.btn`. | Uppercase + tracking + weight via display tokens; hover/active translates handled by `:where([data-design="neobrutalist"])` rules. |
| `<IconButton>` / `<CloseButton>` | Icon-only actions and modal close. | Replaces `NeoCloseButton`; in neo, adopts the offset-shadow chip styling; in modern, a clean ghost icon. |
| `<Field>` | Wraps `.input/.select/.textarea`. | Border + focus translate behavior tokenized; no markup change. *Optional — could stay as raw DaisyUI if `<Field>` adds no value.* |

Consumers write `<Modal>...</Modal>` once. The primitive picks up the right tokens. No `isNeo ? "rounded-none border-4" : "rounded-box border"` ternaries.

### 4.4 Theme registry

Each palette is one CSS file in `src/styles/themes/`:

```
src/styles/themes/
├── _index.ts                  # auto-generated, registry export
├── 80s-vibe.css               # new
├── catppuccin-mocha.css       # renamed from catppuccin
├── catppuccin-latte.css       # renamed from catppuccin-light
├── everforest.css
├── everforest-light.css
├── gruvbox.css
├── gruvbox-light.css
├── gruvbox-material.css
├── gruvbox-material-light.css
├── kanagawa.css
├── kanagawa-light.css
├── nord.css
├── nord-light.css
├── solarized.css              # new
├── solarized-light.css        # new
└── ...
```

A palette CSS file looks like:

```css
/*
 * Nord — palette source: https://www.nordtheme.com/docs/colors-and-palettes
 * Mapping:
 *   base-100/200/300  ← polar-night nord0/nord1/nord2
 *   base-content      ← snow-storm nord6
 *   primary           ← frost nord8
 *   secondary         ← frost nord9
 *   accent            ← frost nord7
 *   info/success/warning/error ← aurora nord11..nord15
 */
@plugin "daisyui/theme" {
  name: "nord";
  default: false;
  prefersdark: true;
  color-scheme: dark;
  --color-base-100: #2e3440;       /* nord0 */
  --color-base-200: #3b4252;       /* nord1 */
  --color-base-300: #434c5e;       /* nord2 */
  --color-base-content: #eceff4;   /* nord6 */
  --color-primary: #88c0d0;        /* nord8 */
  --color-primary-content: #2e3440;
  --color-secondary: #81a1c1;      /* nord9 */
  --color-secondary-content: #2e3440;
  --color-accent: #8fbcbb;         /* nord7 */
  --color-accent-content: #2e3440;
  --color-neutral: #4c566a;        /* nord3 */
  --color-neutral-content: #eceff4;
  --color-info: #5e81ac;           /* nord10 */
  --color-info-content: #eceff4;
  --color-success: #a3be8c;        /* nord14 */
  --color-success-content: #2e3440;
  --color-warning: #ebcb8b;        /* nord13 */
  --color-warning-content: #2e3440;
  --color-error: #bf616a;          /* nord11 */
  --color-error-content: #eceff4;
}
```

A small Vite plugin (`scripts/generate-theme-registry.ts`, run on `dev` and `build`) globs `src/styles/themes/*.css`, extracts metadata via a `/* @waypaper-theme */` JSDoc-style comment block at the top, and emits `src/styles/themes/_index.ts`:

```ts
// AUTO-GENERATED, do not edit
import "./80s-vibe.css";
import "./nord.css";
// ...
export const builtInThemes = [
  { name: "80s-vibe", displayName: "80s Vibe", category: "dark", source: "broadcast-midnight" },
  { name: "nord", displayName: "Nord", category: "dark", source: "https://www.nordtheme.com" },
  // ...
];
```

`src/themes/themes.ts` is replaced by this generated registry. The settings UI consumes `builtInThemes` plus user themes (see §4.5).

### 4.5 User-supplied themes

Daemon side-effects only — UI reads via existing IPC.

1. **Daemon** watches `~/.config/waypaper-engine/themes/` (XDG_CONFIG_HOME) for `*.css` files.
2. **Daemon** exposes:
   - `GET /api/themes` → array of `{ name, displayName?, source: "user" | "builtin", url }`.
   - `GET /api/themes/{name}.css` → raw CSS contents (CSP-safe; daemon validates the file is in the themes dir, no traversal).
3. **Renderer** on boot fetches `GET /api/themes`, then for each user theme injects `<link rel="stylesheet" href="waypaper://api/themes/{name}.css">` (or fetches + injects `<style>` if the link approach hits Electron CSP issues).
4. The theme picker concatenates `builtInThemes` and user themes, grouped under "Built-in" and "Yours" sections.

User theme CSS files MUST contain a valid `@plugin "daisyui/theme"` block. Validation is best-effort: if the CSS doesn't register a theme name DaisyUI recognizes, the picker shows an inline warning ("This theme didn't register cleanly — is the `@plugin daisyui/theme` block correct?").

Add `~/.config/waypaper-engine/themes/.gitignore` template + a one-liner doc page (`docs/customization/themes.md`).

### 4.6 80s Vibe palette spec

Direction: **Broadcast Midnight** (selected during brainstorm).

```css
/*
 * 80s Vibe (Broadcast Midnight)
 * Inspired by Mux's video.js v10 marketing aesthetic.
 * Manila stock + soot + warm-gray surfaces; bright-yellow → magenta
 * accent rainbow. Pairs natively with neobrutalist mode but available
 * to modern as well.
 */
@plugin "daisyui/theme" {
  name: "80s-vibe";
  default: false;
  prefersdark: false;
  color-scheme: light;
  --color-base-100: #f3e7d2;   /* manila-light */
  --color-base-200: #dcd2bb;   /* manila-50 */
  --color-base-300: #bfb39e;   /* manila-dark */
  --color-base-content: #1e1d1d; /* faded-black */
  --color-primary: #ffa81b;    /* gold */
  --color-primary-content: #1e1d1d;
  --color-secondary: #cc3566;  /* magenta */
  --color-secondary-content: #f3e7d2;
  --color-accent: #ff6200;     /* orange */
  --color-accent-content: #1e1d1d;
  --color-neutral: #403c38;    /* warm-gray */
  --color-neutral-content: #f3e7d2;
  --color-info: #ffa81b;
  --color-info-content: #1e1d1d;
  --color-success: #ffca18;    /* bright-yellow as success in this palette */
  --color-success-content: #1e1d1d;
  --color-warning: #ff6200;
  --color-warning-content: #1e1d1d;
  --color-error: #eb3132;      /* red */
  --color-error-content: #f3e7d2;
}
```

A dark companion (`80s-vibe-dark`) ships in the same direction but inverts: soot-100/warm-gray-200/manila-content, same accent set. Optional — ship in initial PR or follow-up.

### 4.7 Paper grid → CSS class

Replace `src/utils/paperGridBackground.ts` with a class in `tokens.css`:

```css
.wp-paper-grid {
  background-image:
    radial-gradient(
      ellipse 80% 60% at 50% 40%,
      transparent 40%,
      oklch(from var(--color-base-content) l c h / calc(var(--wp-paper-grid-alpha) * 1.15)) 100%
    ),
    linear-gradient(90deg,
      oklch(from var(--color-base-content) l c h / var(--wp-paper-grid-alpha)) 1px,
      transparent 1px),
    linear-gradient(
      oklch(from var(--color-base-content) l c h / var(--wp-paper-grid-alpha)) 1px,
      transparent 1px);
  background-size: 100% 100%, var(--wp-paper-grid-size) var(--wp-paper-grid-size),
                   var(--wp-paper-grid-size) var(--wp-paper-grid-size);
  background-repeat: no-repeat, repeat, repeat;
}

.wp-paper-grid--no-vignette {
  /* drop the radial layer */
}
```

`Gallery.tsx` and `StartupIntro.tsx` switch from `style={paperGridBackgroundStyle()}` to `className="wp-paper-grid"`. `paperGridBackground.ts` deletes.

### 4.8 Typography

- **Body**: Inter Variable (unchanged).
- **Mono**: JetBrains Mono (unchanged).
- **Display**:
  - modern → `Space Grotesk Variable` (current).
  - neobrutalist → `Aldrich` (Google Fonts; geometric extended caps; ~25KB variable; Latin only).
- Self-host Aldrich via `@fontsource/aldrich` (CSP-safe, matches existing pattern).
- Headings (`h1–h4`) read `--font-display`, `--wp-display-case`, `--wp-display-tracking`, `--wp-display-weight`. Mode flips all four together.
- Palettes MAY override `--font-display`; built-ins do not.

## 5. Built-in palette set

### 5.1 DaisyUI builtins shipped (22)

`light`, `dark`, `cupcake`, `bumblebee`, `emerald`, `synthwave`, `retro`, `halloween`, `forest`, `lofi`, `pastel`, `wireframe`, `black`, `dracula`, `cmyk`, `autumn`, `business`, `acid`, `lemonade`, `night`, `dim`, `nord`.

### 5.2 DaisyUI builtins dropped (10)

`corporate`, `cyberpunk`, `valentine`, `garden`, `aqua`, `fantasy`, `luxury`, `coffee`, `winter`, `sunset`.

### 5.3 Custom palettes (Linux schemes — keep, audit, rewrite)

Each gets its own file in `src/styles/themes/` with a header comment citing the canonical source doc. Token values rewritten against the source palette's official colors and role mapping:

| File | Source |
|---|---|
| `gruvbox.css` / `gruvbox-light.css` | github.com/morhetz/gruvbox `palette.md` |
| `gruvbox-material.css` / `gruvbox-material-light.css` | github.com/sainnhe/gruvbox-material |
| `everforest.css` / `everforest-light.css` | github.com/sainnhe/everforest |
| `kanagawa.css` / `kanagawa-light.css` | github.com/rebelot/kanagawa.nvim |
| `catppuccin-mocha.css` / `catppuccin-latte.css` | catppuccin.com/palette |
| `nord.css` / `nord-light.css` | nordtheme.com/docs/colors-and-palettes |
| `monokai.css` / `monokai-light.css` | monokai.pro / Wimer Hazenberg's original |
| `tokyo-night.css` / `tokyo-night-light.css` | github.com/folke/tokyonight.nvim |
| `dracula-light.css` | draculatheme.com (light variant approx.) |
| `kolision-raw.css` / `kolision-raw-dark.css` | existing (already faithful, light audit) |

Renames: `catppuccin` → `catppuccin-mocha`; `catppuccin-light` → `catppuccin-latte`; `*-light` suffixes preserved otherwise.

### 5.4 New palettes

| File | Source |
|---|---|
| `solarized.css` / `solarized-light.css` | ethanschoonover.com/solarized |
| `80s-vibe.css` (+ optional `80s-vibe-dark.css` follow-up) | Broadcast Midnight (this spec §4.6) |

### 5.5 Customs dropped

`doublezombie` only.

### 5.6 Total

~22 DaisyUI + ~22 custom variants + 80s Vibe + (optional) 80s Vibe Dark = **~45 built-ins**. (Slightly higher than the brainstorm tally because of the per-direction light/dark splits.)

## 6. Defaults

- **Default design mode**: `modern`.
- **Default palette**: respect `prefers-color-scheme` → `light` if light, `dark` if dark, fallback `light`.
- Both persisted to `localStorage` under existing `waypaper-design-system` and `waypaper-theme` keys.

## 7. Migration plan (component & file scope)

### 7.1 Files to delete

- `src/utils/paperGridBackground.ts` (replaced by `.wp-paper-grid` class).
- `src/themes/themes.ts` (replaced by generated `src/styles/themes/_index.ts`).
- The `index.css` block defining `@plugin "daisyui/theme"` blocks for: kolision-raw(+dark), gruvbox(+light), catppuccin(+light), monokai(+light), tokyo-night(+light), everforest(+light), gruvbox-material(+light), kanagawa(+light), dracula-light, nord-light, doublezombie. (Each moves to its own file in `src/styles/themes/`.)
- `.theme-transition`, `.theme-transition-fast`, `.theme-transition-slow` (unused; only `.wp-theme-transition` is actually consumed).
- `.disable-transitions` (unused after the verification audit; if used anywhere, reuse `.wp-theme-transition` removal or document).
- `.theme-scrollbar` block (redundant with global `::-webkit-scrollbar`).

### 7.2 Files to refactor

- `src/index.css`: keep Tailwind/DaisyUI plugin imports, font imports, `:root` global vars, scrollbar block, context-menu styles. Drop the per-palette `@plugin` blocks (now imported via `_index.ts`).
- `src/styles/tokens.css`: extend with all new `--wp-*` mode tokens (§4.2) and the `.wp-paper-grid` class (§4.7).
- `src/styles/neobrutalist.css`: shrink from 1409 → ~250 lines. Keep only:
  - polaroid card markup styles (`.neo-polaroid-image`, hover transforms);
  - striped modal header styles (`.neo-modal-header-stripes`);
  - close-button chip styles (`.neo-close-btn`);
  - `:active` translate behavior on `.btn`, `.input`, `.select`, `.textarea` (now sourced from `--wp-shadow-*` tokens).
  - Everything else (radius, border-width, plain shadows, font casing) deletes — it's now covered by `--wp-*` tokens DaisyUI already reads.

### 7.3 Components to convert (31 `useIsNeo` consumers)

Categorized by the conversion type:

**Replace with `<Modal>` primitive** (all dialogs / drawer-style modals):

`AddToPlaylistModal`, `AdvancedFiltersModal`, `ConfirmDialog`, `FolderImportModal`, `FolderPickerModal`, `GalleryFilterCheatsheetModal`, `LoadPlaylistModal`, `MonitorsModal`, `PlaylistConfigurationModal`, `SavePlaylistModal`, `SettingsModal`. `ModalStripedHeader` is folded into `<Modal>` as a sub-slot (`<Modal.Header variant="striped">`).

**Replace with `<Card>` primitive**:

`FolderCard` → `<Card>` (the polaroid path lives inside `<Card>`). `MiniPlaylistCard` → `<Card>`. `ImageCard` keeps its image/metadata logic but adopts `<Card>` for the frame and elevation so its polaroid path is consistent with `FolderCard`.

**Replace with `<CloseButton>` / `<IconButton>`**:

`NeoCloseButton` → `<CloseButton>` (component renames; per `CLAUDE.md` "no compat shims" rule, the old name is removed in the same PR — no alias period). `MonitorButton` → `<IconButton>`.

**Drop the hook entirely (token-driven, no markup or primitive change needed)** — convert by replacing `isNeo ? "rounded-none border-4 border-base-content/20" : "rounded-box border border-base-300"` ternaries with a single class stack that reads `--wp-radius-*` / `--wp-border-*` / `--wp-elev-*`:

`BottomDock`, `Filters`, `ImageDetailSidebar`, `LoopStudioYtDlpBanner`, `PlaylistController`, `PlaylistTrack`, `InlineThemeSelector`, `AppSettingsSection`, `SettingsTabs`, `History`, `LoopStudio`, `ShaderStudio`, `Wallhaven`, `ModernSidebar`.

**Keep `useIsNeo()`** (genuinely structural divergence):

`ContextMenu` (different markup paths between `.context-menu` and `.neo-context-menu`), and the new primitives themselves (`Modal`, `Card`, `Button`, `CloseButton`).

Final `useIsNeo()` consumer count: **5 files** (the four primitives + `ContextMenu`).

### 7.4 Component primitive locations

```
src/components/ui/
├── Surface.tsx            # new
├── Card.tsx               # new (consolidates ImageCard frame + FolderCard + polaroid logic)
├── Modal/
│   ├── Modal.tsx          # new (replaces ad-hoc modal-box usages)
│   ├── ModalHeader.tsx    # absorbs ModalStripedHeader
│   └── index.ts
├── Button.tsx             # new (wraps DaisyUI .btn)
├── IconButton.tsx         # new (replaces NeoCloseButton)
└── Field.tsx              # optional; only if it earns its weight
```

`ImageCard.tsx` and `FolderCard.tsx` are not deleted — they become consumers of `<Card>` for their frame/elevation, keeping their own image/metadata logic.

## 8. Build & registry generator

- New script: `scripts/generate-theme-registry.ts`. Vite plugin form preferred so it runs as part of `pnpm dev` / `npm run dev` and `npm run build`.
- Watches `src/styles/themes/*.css`, parses the `/* @waypaper-theme */` JSDoc-style header for `name`, `displayName`, `category` (light|dark|mixed), `source` (URL).
- Generates `src/styles/themes/_index.ts` with side-effect imports (so DaisyUI sees the `@plugin` blocks) + a typed `builtInThemes` array.
- File is committed (not gitignored) so `pnpm build` doesn't depend on a generator step at install time.

## 9. Daemon work

Minimal — a thin endpoint pair under `/api/themes`:

- `GET /api/themes` — lists user CSS files in `$XDG_CONFIG_HOME/waypaper-engine/themes/` (or `~/.config/waypaper-engine/themes/` fallback). Returns `[{name, displayName, source: "user", url: "/api/themes/{name}.css"}]`. Filenames are the theme name; an optional `# displayName: ...` comment in line 1 of the CSS overrides.
- `GET /api/themes/{name}.css` — serves the file if it's inside the themes dir (path-traversal check), `text/css; charset=utf-8`. Returns 404 otherwise.

API contract update: add to `daemon/API_CONTRACT.md`. No new SSE events for theme changes in v1 (renderer can poll on settings open or refresh after explicit user action).

## 10. Out of scope / future

- In-app palette editor with color pickers and live preview → future feature.
- Hot-reloading user themes when the file changes on disk → future (poll on settings panel open is sufficient for v1).
- Sharing themes (export/import bundles, or a community palette gallery).
- Migrating to Tailwind v4 `@theme` blocks for waypaper tokens (current `:root` approach is fine; v10's pattern is a good reference if we revisit).
- Per-monitor design mode.
- A "high contrast" or accessibility-tuned mode.

## 11. Risks & open questions

1. **DaisyUI v5 + multiple `@plugin "daisyui/theme"` blocks across files** — **RESOLVED (Task 3.6)**: Took the bundled CSS path. The Vite plugin generates both `_index.ts` (TS side-effect imports for tree-shaking) and `_index.css` (concatenated CSS for DaisyUI). `src/index.css` imports `_index.css` directly via `@import "./styles/themes/_index.css"`, ensuring all `@plugin "daisyui/theme"` blocks are visible to Tailwind v4's CSS pipeline at build time.
2. **Aldrich variable axes** — Aldrich is a single-style font on Google Fonts, not variable. If we want a true variable display face, swap to **Oxanium Variable** (similar geometric vibe, more weights). Decide during implementation; this is a one-line palette font change.
3. **`prefers-color-scheme` reliability in Electron** — verify in the renderer; otherwise the default falls back to `light`.
4. **User-theme CSP** — Electron renderer's CSP must allow `<link>`/`<style>` injection from the daemon's HTTP origin. Confirm during implementation; current daemon is already trusted.
5. **Test coverage** — `ImageCard.test.tsx`, `ModernAppLayout.test.tsx` reference `useIsNeo`. They'll need updates when consumers stop using the hook. Inventory & update tests as part of conversion PRs.
6. **Visual regression risk** — converting 31 components is broad. Mitigate by (a) doing an early "paper grid + tokens" PR that's a no-op visual change and validates the token plumbing, and (b) splitting primitive conversion into 4 PRs (Modal, Card, Button, IconButton) so each is reviewable.

## 12. Deliverables summary

1. `src/styles/tokens.css` extended with all `--wp-*` mode tokens + `.wp-paper-grid`.
2. `src/styles/themes/` directory with one CSS file per built-in palette (~45 files), each with a header citing its source.
3. Auto-generated `src/styles/themes/_index.ts` registry; `src/themes/themes.ts` deleted.
4. `src/styles/neobrutalist.css` shrunk to ~250 lines (token-driven + structural-only rules).
5. `src/index.css` cleaned: per-palette blocks removed; unused transition utilities removed; redundant scrollbar styles removed.
6. `src/components/ui/` primitives: `Surface`, `Card`, `Modal` (+ `ModalHeader`), `Button`, `IconButton`. `<Field>` optional.
7. 31 `useIsNeo` consumer files refactored to use primitives + tokens; `useIsNeo` retained only in primitives + `ContextMenu` (5 files).
8. `paperGridBackground.ts` deleted; `Gallery.tsx` + `StartupIntro.tsx` switch to `.wp-paper-grid`.
9. Daemon endpoints `GET /api/themes` and `GET /api/themes/{name}.css` + API contract update.
10. New built-in palettes: `solarized`, `solarized-light`, `80s-vibe` (+ optional `80s-vibe-dark`).
11. Aldrich (or Oxanium) self-hosted via fontsource.
12. Existing custom palettes audited and rewritten against canonical source docs (Nord first; the others as part of the same workstream).
13. Tests updated; settings UI reflects the new palette pool grouped by built-in / yours.
14. Short docs page: `docs/customization/themes.md` covering drop-in CSS format + `@plugin "daisyui/theme"` example.
