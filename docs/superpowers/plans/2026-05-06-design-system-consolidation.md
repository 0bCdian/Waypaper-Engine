# Design System Consolidation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the waypaper-engine frontend into a coherent two-mode (`modern` + `neobrutalist`), token-driven design system with an extensible palette registry — reducing `useIsNeo()` consumers from 31 → 5, shrinking `neobrutalist.css` toward a token-driven core (the original ~250 line target is incremental), and shipping a **curated ~23+** built-in palettes (light/dark pairs) plus a user drop-in CSS folder. *An earlier ~45 palette tally was an upper planning bound; the shipped registry size is tracked in `src/styles/themes/_index.ts`.*

**Architecture:** 3-layer cake — palette tokens (DaisyUI `--color-*`, one CSS file per palette, auto-registered) → mode tokens (`--wp-*` set on `:root` for modern, overridden on `[data-design="neobrutalist"]`) → component primitives (`Surface`, `Card`, `Button`, `IconButton`/`CloseButton` in `src/components/ui/`; **modal shell in [`src/components/Modal.tsx`](../../../src/components/Modal.tsx)** with `<dialog>`, `Modal.Header`, and [`modalStore`](../../../src/stores/modalStore.ts)) that consumers compose. Mode-switching is one DOM attribute write; palette-switching is another. End-users add palettes by dropping CSS into `~/.config/waypaper-engine/themes/*.css`, served via a thin daemon endpoint pair.

**DaisyUI caveat:** Custom palettes that must override Daisy’s `:where(:root)` light fallback may need **`html[data-theme="…"]`** variable blocks in [`src/index.css`](../../../src/index.css) (see 80s-vibe).

**Tech Stack:** React 19, Vite, Tailwind v4, DaisyUI v5, Zustand, Vitest (frontend); Go 1.26, chi router (daemon). Test runner: `npm test` (Vitest), `npm run test:daemon:unit` (Go), `npm run ci:check` for the full gate.

**Spec:** [`docs/superpowers/specs/2026-05-06-design-system-consolidation-design.md`](../specs/2026-05-06-design-system-consolidation-design.md)

---

## Conventions

- **Branch:** all work lands on `refactor/waypaper-engine` (per `CLAUDE.md`). Use feature sub-branches per phase if you want, rebased onto `refactor/waypaper-engine` at the end of each phase.
- **Tests:** every primitive and every non-trivial utility ships with a Vitest test. Phase 6 ships Go tests for the daemon endpoint pair.
- **Commits:** one logical change per commit. Format: `feat(design): ...`, `refactor(design): ...`, `test(design): ...`, `chore(design): ...`, `fix(design): ...`. Frequent commits beat big ones.
- **Verification at the end of every task:** `npm run lint:check && npx tsc --noEmit && npm test` should pass before commit. If a task only touches CSS, `npm run format:check` is enough.
- **No compat shims** (per `CLAUDE.md`): when renaming/removing exports, update consumers in the same PR. Don't leave aliases.
- **DaisyUI v5 quirk** (spec §11.1): the registry does side-effect imports of every palette CSS via the generated `_index.ts`. If the build spike (Phase 3) shows DaisyUI doesn't pick up multi-file `@plugin "daisyui/theme"` blocks reliably, fall back to the bundled approach noted in Task 3.6.

---

## Phase 0 — Branch & sanity check

### Task 0.1: Verify clean working tree and target branch

**Files:** none (verification only).

- [ ] **Step 1: Confirm branch and clean tree**

```bash
cd /home/obsy/dev/waypaper/waypaper-engine
git status
git rev-parse --abbrev-ref HEAD
```

Expected: branch is `refactor/waypaper-engine` (or you've created a sub-branch off it). Working tree clean.

- [ ] **Step 2: Run baseline checks (so regressions later are unambiguous)**

```bash
npm run lint:check && npx tsc --noEmit && npm test
```

Expected: PASS. If anything fails on `main`/`refactor/waypaper-engine`, stop and fix that first — it's not part of this work.

---

## Phase 1 — Foundation: token layer + paper grid

This phase introduces the new mode tokens **without changing any visual behavior**. Existing `--wp-*` tokens in `tokens.css` are kept; new ones are added. Components keep using the old paths; the new paths are wired in Phase 8+.

### Task 1.1: Extend `src/styles/tokens.css` with new mode tokens

**Files:**
- Modify: `src/styles/tokens.css`

- [ ] **Step 1: Add new `--wp-*` tokens to `:root` (modern defaults), preserving existing tokens**

Insert after the existing `:root` block's `--wp-elev-3` definition, before the gallery vars:

```css
/* Mode tokens — modern (default) */
:root {
  /* Borders */
  --wp-border-w: 1px;
  --wp-border-color: oklch(from var(--color-base-content) l c h / 0.12);

  /* Display typography (mode-driven) */
  --wp-display-case: none;
  --wp-display-tracking: -0.01em;
  --wp-display-weight: 700;

  /* Paper grid (gallery, startup) */
  --wp-paper-grid-size: 24px;
  --wp-paper-grid-alpha: 0.07;
}
```

- [ ] **Step 2: Extend the `[data-design="neobrutalist"]` block with new tokens**

Replace the existing neobrutalist block contents with:

```css
[data-design="neobrutalist"] {
  /* Existing radius overrides */
  --wp-radius-sm: 0px;
  --wp-radius-md: 0px;
  --wp-radius-lg: 0px;
  --wp-radius-xl: 0px;

  /* Borders */
  --wp-border-w: var(--neo-border-width, 4px);
  --wp-border-color: oklch(from var(--color-base-content) l c h / 0.9);

  /* Hard offset shadows replace elevations */
  --wp-elev-1: var(--neo-shadow-x, 8px) var(--neo-shadow-y, 8px) 0 0 #000;
  --wp-elev-2:
    calc(var(--neo-shadow-x, 8px) * 1.5) calc(var(--neo-shadow-y, 8px) * 1.5) 0 0 #000;
  --wp-elev-3: calc(var(--neo-shadow-x, 8px) * 2) calc(var(--neo-shadow-y, 8px) * 2) 0 0 #000;

  /* Display typography */
  --wp-display-case: uppercase;
  --wp-display-tracking: 0.02em;
  --wp-display-weight: 800;

  /* Paper grid — slightly stronger */
  --wp-paper-grid-alpha: 0.10;
}
```

- [ ] **Step 3: Add the `.wp-paper-grid` semantic class**

Append at end of file:

```css
/* Math-paper grid background — used by Gallery and StartupIntro.
   Color comes from the active palette via --color-base-content;
   density and intensity are mode-driven via --wp-paper-grid-*. */
.wp-paper-grid {
  background-image:
    radial-gradient(
      ellipse 80% 60% at 50% 40%,
      transparent 40%,
      oklch(from var(--color-base-content) l c h / calc(var(--wp-paper-grid-alpha) * 1.15)) 100%
    ),
    linear-gradient(
      90deg,
      oklch(from var(--color-base-content) l c h / var(--wp-paper-grid-alpha)) 1px,
      transparent 1px
    ),
    linear-gradient(
      oklch(from var(--color-base-content) l c h / var(--wp-paper-grid-alpha)) 1px,
      transparent 1px
    );
  background-size:
    100% 100%,
    var(--wp-paper-grid-size) var(--wp-paper-grid-size),
    var(--wp-paper-grid-size) var(--wp-paper-grid-size);
  background-repeat: no-repeat, repeat, repeat;
}

.wp-paper-grid--no-vignette {
  background-image:
    linear-gradient(
      90deg,
      oklch(from var(--color-base-content) l c h / var(--wp-paper-grid-alpha)) 1px,
      transparent 1px
    ),
    linear-gradient(
      oklch(from var(--color-base-content) l c h / var(--wp-paper-grid-alpha)) 1px,
      transparent 1px
    );
  background-size:
    var(--wp-paper-grid-size) var(--wp-paper-grid-size),
    var(--wp-paper-grid-size) var(--wp-paper-grid-size);
  background-repeat: repeat, repeat;
}
```

- [ ] **Step 4: Verify**

```bash
npm run format:check && npm run dev
```

Open the running app, switch to neobrutalist mode in settings; nothing should change visually yet.

- [ ] **Step 5: Commit**

```bash
git add src/styles/tokens.css
git commit -m "feat(design): add mode tokens and .wp-paper-grid class"
```

### Task 1.2: Replace `paperGridBackground.ts` consumers with `.wp-paper-grid` class

**Files:**
- Modify: `src/components/Gallery.tsx` (around line 17 import, line 145 inline style usage)
- Modify: `src/components/StartupIntro.tsx`
- Delete: `src/utils/paperGridBackground.ts` (after consumers migrate)

- [ ] **Step 1: Update `Gallery.tsx`**

Remove the import at line 17 (`import { paperGridBackgroundStyle } from "../utils/paperGridBackground";`) and replace the `style={paperGridBackgroundStyle()}` at line 145 with `className="... wp-paper-grid ..."`. Preserve any other classes already on that element.

- [ ] **Step 2: Update `StartupIntro.tsx`**

Find any usage of `paperGridBackgroundStyle()` and replace with `className="wp-paper-grid"` (or `.wp-paper-grid--no-vignette` if vignette was off). Remove the import.

```bash
grep -n "paperGridBackground" src/components/StartupIntro.tsx
```

- [ ] **Step 3: Delete the util**

```bash
rm src/utils/paperGridBackground.ts
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit && npm test
```

Run `npm run dev` and verify the gallery still has its grid background and the startup intro looks the same.

- [ ] **Step 5: Commit**

```bash
git add src/components/Gallery.tsx src/components/StartupIntro.tsx
git rm src/utils/paperGridBackground.ts
git commit -m "refactor(design): migrate paper grid to .wp-paper-grid class"
```

---

## Phase 2 — Aldrich display font for neobrutalist mode

### Task 2.1: Install Aldrich via fontsource

**Files:**
- Modify: `package.json`
- Modify: `src/index.css` (font imports + `--font-display` definition)

- [ ] **Step 1: Install**

```bash
npm install --save-exact @fontsource/aldrich@5
```

Aldrich on Google Fonts is a single weight (400). If Phase 11 risk-check (spec §11.2) calls for variable, swap to `@fontsource-variable/oxanium` then. Default in this plan: Aldrich.

- [ ] **Step 2: Add font import to `src/index.css`**

After the existing `@import "@fontsource/jetbrains-mono/700.css";` line (line 8), add:

```css
@import "@fontsource/aldrich/400.css";
```

- [ ] **Step 3: Set `--font-display` via mode tokens**

Edit `src/index.css` `:root` block (around line 36-41) — keep the existing `--font-body`/`--font-mono` lines and ensure `--font-display` is defined for the modern default:

```css
:root {
  --font-body: "Inter Variable", "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Space Grotesk Variable", "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
  font-family: var(--font-body);
}
```

(Current code already has this — confirm; if not, set it.)

- [ ] **Step 4: Override `--font-display` in `tokens.css` for neobrutalist mode**

Edit the `[data-design="neobrutalist"]` block in `src/styles/tokens.css` and add (alongside the display tokens added in Task 1.1):

```css
  --font-display: "Aldrich", "Space Grotesk Variable", system-ui, sans-serif;
```

- [ ] **Step 5: Update headings rule in `index.css`**

Find the `h1, h2, h3, h4 { font-family: var(--font-display); }` block (around line 50-55) and extend it:

```css
h1, h2, h3, h4 {
  font-family: var(--font-display);
  font-weight: var(--wp-display-weight, 700);
  letter-spacing: var(--wp-display-tracking, -0.01em);
  text-transform: var(--wp-display-case, none);
}
```

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit && npm run dev
```

Switch to neobrutalist mode — headings should now render in Aldrich, uppercase, with positive tracking. Switch back — Space Grotesk, normal case.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/index.css src/styles/tokens.css
git commit -m "feat(design): wire Aldrich display font for neobrutalist mode"
```

---

## Phase 3 — Theme registry foundation

### Task 3.1: Create themes directory and registry types

**Files:**
- Create: `src/styles/themes/.gitkeep` (empty file so the dir exists in git)
- Create: `src/styles/themes/types.ts`

- [ ] **Step 1: Create directory**

```bash
mkdir -p src/styles/themes
touch src/styles/themes/.gitkeep
```

- [ ] **Step 2: Write the registry types**

Create `src/styles/themes/types.ts`:

```ts
export type ThemeCategory = "light" | "dark" | "mixed";
export type ThemeSource = "builtin" | "user";

export interface ThemeMeta {
  /** DaisyUI theme name (matches the @plugin block's `name:` field). */
  name: string;
  /** Human-readable name for the picker. */
  displayName: string;
  /** Brightness category for grouping/filtering. */
  category: ThemeCategory;
  /** Where the theme came from. */
  source: ThemeSource;
  /** Source palette URL (built-ins only) — for traceability. */
  sourceUrl?: string;
}

export interface BuiltinThemeMeta extends ThemeMeta {
  source: "builtin";
}

export interface UserThemeMeta extends ThemeMeta {
  source: "user";
  /** Daemon-served URL the renderer fetches. */
  url: string;
}
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/styles/themes/
git commit -m "feat(design): scaffold themes/ directory and registry types"
```

### Task 3.2: Write the Vite plugin that auto-generates the registry

**Files:**
- Create: `scripts/vite-plugin-theme-registry.ts`
- Modify: `vite.config.ts` (register the plugin)

- [ ] **Step 1: Author the plugin**

Create `scripts/vite-plugin-theme-registry.ts`:

```ts
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

interface HeaderMeta {
  name: string;
  displayName: string;
  category: "light" | "dark" | "mixed";
  sourceUrl?: string;
}

const HEADER_RE = /\/\*\s*@waypaper-theme\s*\n([\s\S]*?)\*\//;

function parseHeader(css: string): HeaderMeta | null {
  const m = css.match(HEADER_RE);
  if (!m) return null;
  const lines = m[1]
    .split("\n")
    .map((l) => l.replace(/^\s*\*?\s?/, "").trim())
    .filter(Boolean);
  const fields: Record<string, string> = {};
  for (const line of lines) {
    const eq = line.indexOf(":");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    fields[key] = value;
  }
  if (!fields.name || !fields.displayName || !fields.category) return null;
  return {
    name: fields.name,
    displayName: fields.displayName,
    category: fields.category as HeaderMeta["category"],
    sourceUrl: fields.sourceUrl,
  };
}

export function themeRegistryPlugin(opts: { themesDir: string; outFile: string }): Plugin {
  const { themesDir, outFile } = opts;

  async function generate() {
    const entries = (await fs.readdir(themesDir))
      .filter((f) => f.endsWith(".css"))
      .sort();
    const metas: Array<HeaderMeta & { file: string }> = [];
    for (const file of entries) {
      const css = await fs.readFile(path.join(themesDir, file), "utf8");
      const meta = parseHeader(css);
      if (!meta) {
        // eslint-disable-next-line no-console
        console.warn(`[theme-registry] ${file} missing @waypaper-theme header — skipped`);
        continue;
      }
      metas.push({ ...meta, file });
    }

    const importLines = metas.map((m) => `import "./${m.file}";`).join("\n");
    const arrayBody = metas
      .map((m) =>
        `  { name: ${JSON.stringify(m.name)}, ` +
        `displayName: ${JSON.stringify(m.displayName)}, ` +
        `category: ${JSON.stringify(m.category)}, ` +
        `source: "builtin"` +
        (m.sourceUrl ? `, sourceUrl: ${JSON.stringify(m.sourceUrl)}` : "") +
        ` }`,
      )
      .join(",\n");

    const out = `// AUTO-GENERATED by vite-plugin-theme-registry. Do not edit.\nimport type { BuiltinThemeMeta } from "./types";\n\n${importLines}\n\nexport const builtInThemes: readonly BuiltinThemeMeta[] = [\n${arrayBody},\n] as const;\n`;

    const existing = await fs.readFile(outFile, "utf8").catch(() => "");
    if (existing !== out) await fs.writeFile(outFile, out, "utf8");
  }

  return {
    name: "waypaper:theme-registry",
    async buildStart() {
      await generate();
    },
    configureServer(server) {
      server.watcher.add(themesDir);
      const onChange = (file: string) => {
        if (file.startsWith(themesDir) && file.endsWith(".css")) generate();
      };
      server.watcher.on("add", onChange);
      server.watcher.on("unlink", onChange);
      server.watcher.on("change", onChange);
    },
  };
}
```

- [ ] **Step 2: Register the plugin in `vite.config.ts`**

Add the import at the top:

```ts
import { themeRegistryPlugin } from "./scripts/vite-plugin-theme-registry";
import path from "node:path";
```

Add to `plugins:` array:

```ts
themeRegistryPlugin({
  themesDir: path.resolve(__dirname, "src/styles/themes"),
  outFile: path.resolve(__dirname, "src/styles/themes/_index.ts"),
}),
```

- [ ] **Step 3: Verify the plugin runs (no themes yet — should produce empty registry)**

```bash
npm run dev
# Wait for vite to start, then Ctrl+C
cat src/styles/themes/_index.ts
```

Expected: a file with header comment, no imports, `builtInThemes: readonly ... = [\n] as const;`.

- [ ] **Step 4: Commit**

```bash
git add scripts/vite-plugin-theme-registry.ts vite.config.ts src/styles/themes/_index.ts
git commit -m "feat(design): add Vite plugin auto-generating theme registry"
```

### Task 3.3: Write a smoke test for the registry parser

**Files:**
- Create: `scripts/__tests__/vite-plugin-theme-registry.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, expect, it } from "vitest";

// We import the parseHeader helper indirectly by testing the generated output;
// since the plugin doesn't export parseHeader, fixture-based tests are added
// once we have real palettes (Phase 4). For now, smoke-test that the dev server
// produced a valid _index.ts and that builtInThemes is a readonly array.

import { builtInThemes } from "../../src/styles/themes/_index";

describe("theme registry", () => {
  it("exports a readonly builtInThemes array", () => {
    expect(Array.isArray(builtInThemes)).toBe(true);
  });

  it("each theme entry has required fields", () => {
    for (const t of builtInThemes) {
      expect(typeof t.name).toBe("string");
      expect(typeof t.displayName).toBe("string");
      expect(["light", "dark", "mixed"]).toContain(t.category);
      expect(t.source).toBe("builtin");
    }
  });
});
```

- [ ] **Step 2: Run**

```bash
npx vitest run scripts/__tests__/vite-plugin-theme-registry.test.ts
```

Expected: PASS (with empty `builtInThemes`).

- [ ] **Step 3: Commit**

```bash
git add scripts/__tests__/vite-plugin-theme-registry.test.ts
git commit -m "test(design): smoke-test theme registry generation"
```

### Task 3.4: Author one canonical palette as the template — Nord

This is the user's flagged "doesn't match the source" example. We do it first as the reference template; the rest of Phase 4 follows the same pattern.

**Files:**
- Create: `src/styles/themes/nord.css`
- Create: `src/styles/themes/nord-light.css`

- [ ] **Step 1: Author `nord.css`**

```css
/* @waypaper-theme
 *   name: nord
 *   displayName: Nord
 *   category: dark
 *   sourceUrl: https://www.nordtheme.com/docs/colors-and-palettes
 *
 * Source palette role mapping (Polar Night / Snow Storm / Frost / Aurora):
 *   base-100/200/300       ← polar night nord0/nord1/nord2
 *   base-content           ← snow storm nord6
 *   primary                ← frost nord8
 *   primary-content        ← polar night nord0
 *   secondary              ← frost nord9
 *   accent                 ← frost nord7
 *   neutral                ← polar night nord3
 *   info                   ← frost nord10
 *   success                ← aurora nord14
 *   warning                ← aurora nord13
 *   error                  ← aurora nord11
 */
@plugin "daisyui/theme" {
  name: "nord";
  default: false;
  prefersdark: true;
  color-scheme: dark;
  --color-base-100: #2e3440;
  --color-base-200: #3b4252;
  --color-base-300: #434c5e;
  --color-base-content: #eceff4;
  --color-primary: #88c0d0;
  --color-primary-content: #2e3440;
  --color-secondary: #81a1c1;
  --color-secondary-content: #2e3440;
  --color-accent: #8fbcbb;
  --color-accent-content: #2e3440;
  --color-neutral: #4c566a;
  --color-neutral-content: #eceff4;
  --color-info: #5e81ac;
  --color-info-content: #eceff4;
  --color-success: #a3be8c;
  --color-success-content: #2e3440;
  --color-warning: #ebcb8b;
  --color-warning-content: #2e3440;
  --color-error: #bf616a;
  --color-error-content: #eceff4;
  --radius-selector: 0.5rem;
  --radius-field: 0.5rem;
  --radius-box: 0.5rem;
  --size-selector: 0.25rem;
  --size-field: 0.25rem;
  --border: 1px;
  --depth: 1;
  --noise: 0;
}
```

- [ ] **Step 2: Author `nord-light.css`**

Source palette is dark; Nord doesn't ship an official light variant. Use the snow-storm range as the surfaces and dim the frost accents toward the polar-night content color. Header documents that the light variant is a derived companion, not canonical.

```css
/* @waypaper-theme
 *   name: nord-light
 *   displayName: Nord Light
 *   category: light
 *   sourceUrl: https://www.nordtheme.com/docs/colors-and-palettes
 *
 * Derived light companion (Nord ships only a dark canonical palette).
 * Surfaces use Snow Storm; content uses Polar Night nord0; accents
 * keep the same Frost/Aurora hues but darker for AA contrast on a light bg.
 */
@plugin "daisyui/theme" {
  name: "nord-light";
  default: false;
  prefersdark: false;
  color-scheme: light;
  --color-base-100: #eceff4;
  --color-base-200: #e5e9f0;
  --color-base-300: #d8dee9;
  --color-base-content: #2e3440;
  --color-primary: #5e81ac;
  --color-primary-content: #eceff4;
  --color-secondary: #81a1c1;
  --color-secondary-content: #2e3440;
  --color-accent: #8fbcbb;
  --color-accent-content: #2e3440;
  --color-neutral: #4c566a;
  --color-neutral-content: #eceff4;
  --color-info: #5e81ac;
  --color-info-content: #eceff4;
  --color-success: #a3be8c;
  --color-success-content: #2e3440;
  --color-warning: #d08770;
  --color-warning-content: #2e3440;
  --color-error: #bf616a;
  --color-error-content: #eceff4;
  --radius-selector: 0.5rem;
  --radius-field: 0.5rem;
  --radius-box: 0.5rem;
  --size-selector: 0.25rem;
  --size-field: 0.25rem;
  --border: 1px;
  --depth: 1;
  --noise: 0;
}
```

- [ ] **Step 3: Verify the registry picks them up**

```bash
npm run dev
# Wait for vite to start
cat src/styles/themes/_index.ts
```

Expected: `_index.ts` now imports both files and lists both in `builtInThemes`.

- [ ] **Step 4: Manually flip to nord in DevTools**

In the running app, in DevTools console: `document.documentElement.setAttribute('data-theme', 'nord')`. Verify the UI takes Nord colors. Then `document.documentElement.setAttribute('data-theme', 'nord-light')`. Verify light Nord.

- [ ] **Step 5: Commit**

```bash
git add src/styles/themes/nord.css src/styles/themes/nord-light.css src/styles/themes/_index.ts
git commit -m "feat(design): add audited Nord palette (dark + derived light)"
```

### Task 3.5: Wire the registry into `themes.ts` consumers

Currently `src/themes/themes.ts` exports a `themes` record. We replace it with an adapter that combines `builtInThemes` from the registry with what user-themes provide (user-theme integration lands in Phase 7; for now an empty array).

**Files:**
- Modify: `src/themes/themes.ts` (replace contents)
- Modify: `src/themes/types.ts` (re-export new `ThemeMeta` types alongside the legacy `ThemeConfig`, until consumers migrate)

- [ ] **Step 1: Audit all consumers of `themes` and `ThemeConfig`**

```bash
grep -rn "from \".*themes/themes\"\|from \"\\./themes/types\"\|ThemeConfig\b" src --include="*.ts" --include="*.tsx" | head -30
```

Note the consumer files. Common ones: `ThemeContext.tsx`, `InlineThemeSelector.tsx`, settings panels.

- [ ] **Step 2: Replace `src/themes/themes.ts`**

```ts
import type { BuiltinThemeMeta, ThemeMeta } from "../styles/themes/types";
import { builtInThemes } from "../styles/themes/_index";

export type { BuiltinThemeMeta, ThemeMeta };
export { builtInThemes };

/**
 * The full theme list as known *at startup*. User themes register at runtime
 * via `userThemesStore` (Phase 7) and aren't included here.
 */
export const themes: readonly ThemeMeta[] = builtInThemes;

/** Lookup by name (handy for settings UI). */
export function findTheme(name: string): ThemeMeta | undefined {
  return themes.find((t) => t.name === name);
}
```

- [ ] **Step 3: Replace `src/themes/types.ts`**

```ts
export type {
  BuiltinThemeMeta,
  ThemeCategory,
  ThemeMeta,
  ThemeSource,
  UserThemeMeta,
} from "../styles/themes/types";
```

- [ ] **Step 4: Migrate consumers from `ThemeConfig` to `ThemeMeta`**

For each consumer file from Step 1: replace `ThemeConfig` references with `ThemeMeta`. Drop access to `.colors` and `.fonts` (they aren't part of the new model — DaisyUI handles colors via CSS, fonts come from mode tokens). If a consumer depended on the old `colors` shape, that means the consumer was duplicating DaisyUI's job; replace with reading `--color-*` tokens at runtime via `getComputedStyle` only if absolutely necessary.

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit && npm test
```

- [ ] **Step 6: Commit**

```bash
git add src/themes/ src/components/ src/contexts/
git commit -m "refactor(design): wire theme registry into themes.ts and consumers"
```

### Task 3.6: Build spike — confirm DaisyUI registers all `@plugin` blocks

**Files:** none (verification).

- [ ] **Step 1: Add a third palette (a dark and obvious one) and switch to it**

Temporarily create `src/styles/themes/_test-dummy.css` with a high-contrast palette (lurid pink primary on black). Run `npm run dev`, force `data-theme="dummy-test"` in DevTools, confirm the UI flips. Delete the file once verified.

If it does NOT flip (DaisyUI didn't pick up the side-effect import), execute the fallback in Step 2.

- [ ] **Step 2: Fallback — bundle palettes into a single CSS file at build (only if Step 1 fails)**

Modify the Vite plugin so that, alongside `_index.ts`, it also writes `_index.css` containing all palette CSS concatenated. Import `_index.css` from `src/index.css`. Re-run the spike.

- [ ] **Step 3: Document outcome in the spec § 11.1**

Edit `docs/superpowers/specs/2026-05-06-design-system-consolidation-design.md` § 11.1 to record which path was taken.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-05-06-design-system-consolidation-design.md
git commit -m "chore(design): record DaisyUI registration path"
```

If Step 2 was needed:

```bash
git add scripts/vite-plugin-theme-registry.ts src/index.css
git commit -m "fix(design): bundle palettes into _index.css for DaisyUI pickup"
```

---

## Phase 4 — Migrate existing custom palettes (audit & rewrite)

Each palette pair (dark + light) is one task. Each task follows the **same template**:

> 1. Create `src/styles/themes/<name>.css` with the `@waypaper-theme` header citing the source URL and role mapping.
> 2. Write the `@plugin "daisyui/theme"` block with hex values **read from the canonical source linked in the header**, mapped to DaisyUI roles per the rules below.
> 3. Repeat for the light variant if applicable.
> 4. Verify by switching to the theme in DevTools and visually inspecting Gallery, Bottom Dock, a modal, and a primary button.
> 5. Remove the corresponding `@plugin "daisyui/theme"` block from `src/index.css`.
> 6. Commit.

**Role mapping rules** (apply to every palette unless the source has stronger conventions):

| DaisyUI token | Source palette role |
|---|---|
| `--color-base-100` | bg / canonical background (lightest dark or lightest light) |
| `--color-base-200` | bg-soft (one step toward content) |
| `--color-base-300` | bg-strong / borders |
| `--color-base-content` | fg / primary text |
| `--color-primary` | "blue" or canonical accent — the most-used accent |
| `--color-secondary` | "purple" or second accent |
| `--color-accent` | "aqua/cyan/teal" — the brightest non-primary |
| `--color-neutral` | "gray-medium" — UI chrome |
| `--color-info` | "blue/cyan" status |
| `--color-success` | "green" |
| `--color-warning` | "yellow/orange" |
| `--color-error` | "red" |

If the source doc names roles directly (e.g. Catppuccin's `blue`, `mauve`, `teal`, `peach` etc.), prefer those over guessing from hex.

### Task 4.1: Gruvbox + Gruvbox Light

**Files:** `src/styles/themes/gruvbox.css`, `src/styles/themes/gruvbox-light.css`. Source: <https://github.com/morhetz/gruvbox/blob/master/colors/gruvbox.vim> (palette table).

Mapping:
- dark: bg=`#282828`, bg1=`#3c3836`, bg2=`#504945`, fg=`#ebdbb2`, primary=bright-yellow `#fabd2f`, secondary=bright-purple `#d3869b`, accent=bright-aqua `#8ec07c`, neutral=`#7c6f64`, info=bright-blue `#83a598`, success=bright-green `#b8bb26`, warning=bright-orange `#fe8019`, error=bright-red `#fb4934`.
- light: bg=`#fbf1c7`, bg1=`#ebdbb2`, bg2=`#d5c4a1`, fg=`#3c3836`, primary=`#b57614` (faded-yellow on light), secondary=`#8f3f71`, accent=`#427b58`, neutral=`#7c6f64`, info=`#076678`, success=`#79740e`, warning=`#af3a03`, error=`#9d0006`.

- [ ] **Step 1: Create `gruvbox.css`** following template + above mapping.
- [ ] **Step 2: Create `gruvbox-light.css`** following template + above mapping.
- [ ] **Step 3: Remove the old `gruvbox` and `gruvbox-light` `@plugin` blocks from `src/index.css`** (search for `name: "gruvbox"` and `name: "gruvbox-light"`).
- [ ] **Step 4: Verify** by switching to each in DevTools.
- [ ] **Step 5: Commit:** `feat(design): audit gruvbox palette (dark + light)`.

### Task 4.2: Gruvbox Material + light

**Source:** <https://github.com/sainnhe/gruvbox-material/blob/master/colors/gruvbox-material.vim>. Mapping: dark uses `--color-base-100: #282828` (medium contrast); use the palette doc's "medium" column. Light uses `--color-base-100: #fbf1c7`. Confirm primary=`#a9b665` (green), secondary=`#7daea3` (blue), accent=`#d8a657` (yellow), error=`#ea6962`, warning=`#e78a4e`, success=`#a9b665`. The existing values in `index.css` are reasonable — verify against source and adjust only where they drift.

- [ ] Steps 1-5 as in Task 4.1, with `gruvbox-material.css` and `gruvbox-material-light.css`. Commit: `feat(design): audit gruvbox-material palette (dark + light)`.

### Task 4.3: Everforest + light

**Source:** <https://github.com/sainnhe/everforest/blob/master/colors/everforest.vim>. Existing values for the dark variant (`#2d353b`/`#232a2e`/`#343f44`/`#d3c6aa`/`#a7c080` etc.) are correct against source. The light variant in `index.css` was derived approximately — verify against source's `light_medium` palette and rewrite hex values that don't match.

- [ ] Steps 1-5 as in 4.1, files `everforest.css`, `everforest-light.css`. Commit: `feat(design): audit everforest palette (dark + light)`.

### Task 4.4: Kanagawa + light

**Source:** <https://github.com/rebelot/kanagawa.nvim/blob/master/lua/kanagawa/colors.lua>. Use the `wave` palette for dark (existing `#1f1f28` etc. are correct) and `lotus` for light (replace the existing oklch approximations with the lotus hex codes). Lotus base = `#f2ecbc`, content = `#545464`, primary `#4d699b` (blue), secondary `#955f87` (mauve), accent `#597b75` (springGreen), error `#c84053` (samuraiRed), warning `#cc6d00` (autumnYellow), success `#6f894e` (autumnGreen), info `#b35b79` (waveRed).

- [ ] Steps 1-5 as in 4.1, files `kanagawa.css`, `kanagawa-light.css`. Commit: `feat(design): audit kanagawa palette (dark wave + light lotus)`.

### Task 4.5: Catppuccin (rename) + Latte

**Source:** <https://catppuccin.com/palette>. Rename `catppuccin` → `catppuccin-mocha` and `catppuccin-light` → `catppuccin-latte`.

Mocha mapping: base=`#1e1e2e`, mantle=`#181825`, surface0=`#313244`, text=`#cdd6f4`, blue=`#89b4fa`→primary, mauve=`#cba6f7`→secondary, teal=`#94e2d5`→accent, overlay0=`#6c7086`→neutral, sky=`#89dceb`→info, green=`#a6e3a1`→success, yellow=`#f9e2af`→warning, red=`#f38ba8`→error.

Latte mapping: base=`#eff1f5`, mantle=`#e6e9ef`, surface0=`#ccd0da`, text=`#4c4f69`, blue=`#1e66f5`→primary, mauve=`#8839ef`→secondary, teal=`#179299`→accent, overlay0=`#9ca0b0`→neutral, sky=`#04a5e5`→info, green=`#40a02b`→success, yellow=`#df8e1d`→warning, red=`#d20f39`→error.

- [ ] Steps 1-5 as in 4.1, files `catppuccin-mocha.css`, `catppuccin-latte.css`. Update any references in code from `"catppuccin"`/`"catppuccin-light"` to the new names (search `grep -rn 'catppuccin' src/`). Commit: `feat(design): rename catppuccin to mocha/latte and audit palettes`.

### Task 4.6: Monokai + light

**Source:** Original Monokai by Wimer Hazenberg + Monokai Pro. Use Monokai Classic for the dark side: bg=`#272822`, bg1=`#3e3d32`, fg=`#f8f8f2`, pink=`#f92672`→primary, purple=`#ae81ff`→secondary, green=`#a6e22e`→accent, neutral=`#75715e`, info=`#66d9ef`, success=`#a6e22e`, warning=`#fd971f`, error=`#f92672`. Light Monokai is non-canonical — derive a "high-contrast on cream" companion using the same accents on `#fafafa` background.

- [ ] Steps 1-5 as in 4.1, files `monokai.css`, `monokai-light.css`. Commit: `feat(design): audit monokai palette (dark canonical + derived light)`.

### Task 4.7: Tokyo Night + Day

**Source:** <https://github.com/folke/tokyonight.nvim/blob/main/lua/tokyonight/colors>. Use the `night` palette: bg=`#1a1b26`, bg_dark=`#16161e`, bg_highlight=`#292e42`, fg=`#c0caf5`, blue=`#7aa2f7`→primary, magenta=`#bb9af7`→secondary, cyan=`#7dcfff`→accent, terminal_black=`#414868`→neutral, blue1=`#2ac3de`→info, green=`#9ece6a`→success, orange=`#ff9e64`→warning, red=`#f7768e`→error.

`tokyo-night-light` uses the `day` palette: bg=`#e1e2e7`, bg_dark=`#d0d5e3`, bg_highlight=`#a8aecb`, fg=`#3760bf`, blue=`#2e7de9`→primary, magenta=`#9854f1`→secondary, cyan=`#007197`→accent, terminal_black=`#6172b0`→neutral, green=`#587539`→success, orange=`#b15c00`→warning, red=`#f52a65`→error.

- [ ] Steps 1-5 as in 4.1, files `tokyo-night.css`, `tokyo-night-light.css`. Commit: `feat(design): audit tokyo-night palette (night + day)`.

### Task 4.8: Dracula Light

**Source:** <https://draculatheme.com>. Dracula proper is dark; the existing `dracula-light` is a derived companion. Keep the derived approach but tighten contrast: bg=`#f8f8f2`, bg1=`#e0e0d8`, bg2=`#c8c8be`, fg=`#282a36`, primary=`#bd93f9` (purple), secondary=`#ff79c6` (pink), accent=`#8be9fd` (cyan), info=`#6272a4`, success=`#50fa7b`, warning=`#f1fa8c`, error=`#ff5555`. Keep dark Dracula as DaisyUI built-in (no new file needed for `dracula`; it's in the keep-list).

- [ ] Steps 1-5 as in 4.1, file `dracula-light.css` only. Commit: `feat(design): audit dracula-light derived companion`.

### Task 4.9: Kolision Raw + Dark

**Source:** in-repo (existing palette is house-built). Audit lightly: ensure tokens are token-mapped consistently with the others. Keep current OKLCH values unless they fail an AA contrast check on common pairs.

- [ ] Steps 1-5 as in 4.1, files `kolision-raw.css`, `kolision-raw-dark.css`. Commit: `feat(design): move kolision-raw to themes/ directory`.

### Task 4.10: Drop `doublezombie` and remove from `index.css`

**Files:** `src/index.css`

- [ ] **Step 1: Delete the `@plugin` block** named `doublezombie` (around lines 63-96 of current `index.css`).
- [ ] **Step 2: Search for any consumers** referencing it: `grep -rn "doublezombie" src/`. Remove from any theme-list configurations.
- [ ] **Step 3: Verify** with `npx tsc --noEmit && npm test`.
- [ ] **Step 4: Commit:** `chore(design): drop doublezombie palette`.

### Task 4.11: Final cleanup of `src/index.css` palette blocks

**Files:** `src/index.css`

- [ ] **Step 1: Remove every remaining `@plugin "daisyui/theme"` block from `src/index.css`** for palettes now living in `src/styles/themes/`. Confirm none remain:

```bash
grep -c '@plugin "daisyui/theme"' src/index.css
```

Expected: 0.

- [ ] **Step 2: Confirm `_index.ts` is imported in `src/index.css` or `src/main.tsx`** so the side-effect imports register the palettes. Recommended: add to `src/index.css` near the top, after the `tokens.css` import:

```css
/* Auto-registered palette files via vite-plugin-theme-registry */
@import "./styles/themes/_index";
```

(Tailwind v4 / Vite handles `.ts` side-effect imports through CSS via the plugin; if this doesn't work, import `_index.ts` from `src/main.tsx` instead.)

- [ ] **Step 3: Verify** — `npm run dev`, switch through each migrated palette in DevTools and confirm visuals.
- [ ] **Step 4: Commit:** `refactor(design): remove inlined palette blocks from index.css`.

---

## Phase 5 — New palettes: Solarized + 80s Vibe

### Task 5.1: Solarized + Solarized Light

**Files:** `src/styles/themes/solarized.css`, `src/styles/themes/solarized-light.css`. Source: <https://ethanschoonover.com/solarized>.

Solarized (dark): base03=`#002b36`→base-100, base02=`#073642`→base-200, base01=`#586e75`→base-300, base0=`#839496`→base-content (use base1=`#93a1a1` for higher contrast), blue=`#268bd2`→primary, magenta=`#d33682`→secondary, cyan=`#2aa198`→accent, base00=`#657b83`→neutral, blue→info, green=`#859900`→success, yellow=`#b58900`→warning, red=`#dc322f`→error.

Solarized Light: base3=`#fdf6e3`→base-100, base2=`#eee8d5`→base-200, base1=`#93a1a1`→base-300, base00=`#657b83`→base-content (or base01=`#586e75` for more contrast), blue=`#268bd2`→primary, magenta=`#d33682`→secondary, cyan=`#2aa198`→accent, base0=`#839496`→neutral, blue→info, green=`#859900`→success, yellow=`#b58900`→warning, red=`#dc322f`→error.

- [ ] Steps 1-5 as in 4.1. Commit: `feat(design): add solarized palette (dark + light)`.

### Task 5.2: 80s Vibe (Broadcast Midnight)

**Files:** `src/styles/themes/80s-vibe.css`.

- [ ] **Step 1: Create the file** with full content from the spec §4.6:

```css
/* @waypaper-theme
 *   name: 80s-vibe
 *   displayName: 80s Vibe
 *   category: light
 *   sourceUrl: internal:broadcast-midnight
 *
 * Manila stock + soot + warm-gray surfaces; bright-yellow → magenta
 * accent rainbow. Designed to pair with neobrutalist mode but available
 * to modern as well. Inspired by Mux's video.js v10 marketing aesthetic.
 *
 * Palette identity:
 *   manila-light  #f3e7d2  base-100
 *   manila-50     #dcd2bb  base-200
 *   manila-dark   #bfb39e  base-300
 *   faded-black   #1e1d1d  base-content
 *   gold          #ffa81b  primary
 *   magenta       #cc3566  secondary
 *   orange        #ff6200  accent
 *   warm-gray     #403c38  neutral
 *   bright-yellow #ffca18  success
 *   red           #eb3132  error
 */
@plugin "daisyui/theme" {
  name: "80s-vibe";
  default: false;
  prefersdark: false;
  color-scheme: light;
  --color-base-100: #f3e7d2;
  --color-base-200: #dcd2bb;
  --color-base-300: #bfb39e;
  --color-base-content: #1e1d1d;
  --color-primary: #ffa81b;
  --color-primary-content: #1e1d1d;
  --color-secondary: #cc3566;
  --color-secondary-content: #f3e7d2;
  --color-accent: #ff6200;
  --color-accent-content: #1e1d1d;
  --color-neutral: #403c38;
  --color-neutral-content: #f3e7d2;
  --color-info: #ffa81b;
  --color-info-content: #1e1d1d;
  --color-success: #ffca18;
  --color-success-content: #1e1d1d;
  --color-warning: #ff6200;
  --color-warning-content: #1e1d1d;
  --color-error: #eb3132;
  --color-error-content: #f3e7d2;
  --radius-selector: 0.5rem;
  --radius-field: 0.5rem;
  --radius-box: 0.5rem;
  --size-selector: 0.25rem;
  --size-field: 0.25rem;
  --border: 2px;
  --depth: 1;
  --noise: 0;
}
```

- [ ] **Step 2: Verify** — `npm run dev`, switch to `80s-vibe`. Toggle into neobrutalist mode and confirm: cream stock background, gold primary buttons with hard black 8/8 shadow, uppercase Aldrich headings, magenta secondary, orange accent, the gallery's paper grid is slightly amplified.
- [ ] **Step 3: Commit:** `feat(design): add 80s-vibe (broadcast midnight) palette`.

### Task 5.3: Trim DaisyUI builtins to the 22 keepers

The DaisyUI plugin is currently configured `themes: all` in `src/index.css` (around line 60), which loads all 35 builtins. We want only the 22 from spec §5.1.

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Replace the DaisyUI plugin block**

Find the `@plugin "daisyui" { themes: all; exclude: rootscrollgutter; }` block and replace with an explicit list:

```css
@plugin "daisyui" {
  themes:
    light --default,
    dark --prefersdark,
    cupcake,
    bumblebee,
    emerald,
    synthwave,
    retro,
    halloween,
    forest,
    lofi,
    pastel,
    wireframe,
    black,
    dracula,
    cmyk,
    autumn,
    business,
    acid,
    lemonade,
    night,
    dim,
    nord;
  exclude: rootscrollgutter;
}
```

**Note:** if the project already has its own DaisyUI builtin `nord` clashing with the new `nord` audited file in `src/styles/themes/nord.css`, our file wins (it's loaded after via `_index.ts`). Confirm by switching to `nord` in DevTools and verifying the colors match the canonical source, not DaisyUI's default Nord.

- [ ] **Step 2: Verify**

```bash
npm run dev
```

In DevTools console: try `document.documentElement.setAttribute("data-theme", "corporate")` — UI should NOT change to a corporate theme (we removed it). Try `cyberpunk` — same, no change. Try `wireframe` — should switch.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "chore(design): trim DaisyUI builtins to 22 keepers"
```

### Task 5.4: Default palette via `prefers-color-scheme`

Per spec §6: default mode = `modern`; default palette = `light` if user prefers light, `dark` if user prefers dark.

**Files:**
- Modify: `src/contexts/ThemeContext.tsx` (or wherever theme is initialized at app boot)

- [ ] **Step 1: Find current default-theme logic**

```bash
grep -rn "data-theme\|setTheme\|defaultTheme\|initialTheme" src/contexts src/stores 2>/dev/null | head -10
```

- [ ] **Step 2: Modify boot logic to honor `prefers-color-scheme`**

In `ThemeContext.tsx`'s `useEffect` (or equivalent), if no theme is persisted in localStorage, pick:

```ts
const persisted = localStorage.getItem("waypaper-theme");
const initial = persisted ?? (
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
);
document.documentElement.setAttribute("data-theme", initial);
```

If `ThemeContext` doesn't already centralize this, add the logic inline at the same place `data-theme` is set.

- [ ] **Step 3: Verify**

In a fresh browser profile (or after clearing localStorage), launch the app: should boot to `light` if OS is light mode, `dark` if dark. After switching themes once, the persisted choice wins.

- [ ] **Step 4: Commit**

```bash
git add src/contexts/ThemeContext.tsx
git commit -m "feat(design): default theme honors prefers-color-scheme"
```

### Task 5.5: 80s Vibe Dark — optional follow-up

Skip in this initial PR set unless the user specifically requests it. Track in a follow-up issue.

---

## Phase 6 — Daemon `/api/themes` endpoints

### Task 6.1: Plan the Go side — list endpoint

**Files:**
- Create: `daemon/internal/themes/themes.go`
- Create: `daemon/internal/themes/themes_test.go`
- Modify: `daemon/cmd/daemon/main.go` (or wherever routes are registered)

- [ ] **Step 1: Read existing daemon route registration**

```bash
grep -n "chi.Router\|r.Get\|r.Mount" daemon/cmd/daemon/main.go daemon/internal/server/*.go 2>/dev/null | head -20
```

Note the router registration site and the pattern used for filesystem-serving endpoints (if any).

- [ ] **Step 2: Write the failing test for `ListThemes`**

`daemon/internal/themes/themes_test.go`:

```go
package themes_test

import (
	"os"
	"path/filepath"
	"testing"

	"waypaper-engine/daemon/internal/themes"
)

func TestListThemes_ReadsCSSFilesFromDir(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "neon.css"), []byte("/* test */\n@plugin \"daisyui/theme\" { name: \"neon\"; }"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "ignored.txt"), []byte("nope"), 0o644); err != nil {
		t.Fatal(err)
	}

	got, err := themes.List(dir)
	if err != nil {
		t.Fatalf("List error: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("expected 1 theme, got %d", len(got))
	}
	if got[0].Name != "neon" {
		t.Errorf("expected name=neon, got %q", got[0].Name)
	}
}

func TestListThemes_ReturnsEmptyWhenDirMissing(t *testing.T) {
	got, err := themes.List(filepath.Join(t.TempDir(), "doesnotexist"))
	if err != nil {
		t.Fatalf("List error: %v", err)
	}
	if len(got) != 0 {
		t.Errorf("expected empty slice, got %v", got)
	}
}
```

- [ ] **Step 3: Run, see it fail**

```bash
cd daemon && go test ./internal/themes/...
```

Expected: FAIL (package doesn't exist).

- [ ] **Step 4: Implement `themes.go`**

```go
package themes

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

// Theme is the metadata returned for a single user-provided palette.
type Theme struct {
	Name        string `json:"name"`
	DisplayName string `json:"displayName"`
	Source      string `json:"source"` // always "user" for this package
	URL         string `json:"url"`    // /api/themes/{name}.css
}

// List enumerates *.css files in dir and returns their metadata. A missing
// directory is treated as "no themes" (empty slice, nil error).
func List(dir string) ([]Theme, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return []Theme{}, nil
		}
		return nil, fmt.Errorf("read themes dir: %w", err)
	}

	out := make([]Theme, 0, len(entries))
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".css") {
			continue
		}
		name := strings.TrimSuffix(e.Name(), ".css")
		out = append(out, Theme{
			Name:        name,
			DisplayName: name,
			Source:      "user",
			URL:         "/api/themes/" + name + ".css",
		})
	}
	return out, nil
}

// Open returns a reader for {name}.css inside dir. It rejects any path
// that escapes dir (defense against `../etc/passwd`-style traversal).
func Open(dir, name string) (*os.File, error) {
	if name == "" || strings.ContainsAny(name, `/\`) || name == "." || name == ".." {
		return nil, fs.ErrInvalid
	}
	full := filepath.Join(dir, name+".css")
	resolved, err := filepath.EvalSymlinks(full)
	if err != nil {
		return nil, err
	}
	resolvedDir, err := filepath.EvalSymlinks(dir)
	if err != nil {
		return nil, err
	}
	if !strings.HasPrefix(resolved, resolvedDir+string(filepath.Separator)) && resolved != resolvedDir {
		return nil, fs.ErrPermission
	}
	return os.Open(resolved)
}
```

- [ ] **Step 5: Run tests until they pass**

```bash
cd daemon && go test ./internal/themes/... -v
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add daemon/internal/themes/
git commit -m "feat(daemon): list user themes from XDG config dir"
```

### Task 6.2: Add path-traversal test for `Open`

**Files:**
- Modify: `daemon/internal/themes/themes_test.go`

- [ ] **Step 1: Append failing tests**

```go
func TestOpen_RejectsPathTraversal(t *testing.T) {
	dir := t.TempDir()
	if _, err := themes.Open(dir, "../../etc/passwd"); err == nil {
		t.Errorf("expected error for ../../etc/passwd, got nil")
	}
	if _, err := themes.Open(dir, ""); err == nil {
		t.Errorf("expected error for empty name, got nil")
	}
	if _, err := themes.Open(dir, "with/slash"); err == nil {
		t.Errorf("expected error for slashed name, got nil")
	}
}

func TestOpen_ReadsValidFile(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "x.css"), []byte("body{}"), 0o644); err != nil {
		t.Fatal(err)
	}
	f, err := themes.Open(dir, "x")
	if err != nil {
		t.Fatalf("Open error: %v", err)
	}
	defer f.Close()
}
```

- [ ] **Step 2: Run**

```bash
cd daemon && go test ./internal/themes/... -v
```

Expected: PASS (the implementation already handles these cases).

- [ ] **Step 3: Commit**

```bash
git add daemon/internal/themes/themes_test.go
git commit -m "test(daemon): cover path-traversal in themes.Open"
```

### Task 6.3: Wire HTTP routes

**Files:**
- Modify: the daemon's HTTP route registration site (likely `daemon/internal/server/server.go` or similar)
- Modify: `daemon/API_CONTRACT.md`

- [ ] **Step 1: Determine the user themes directory**

Use `os.UserConfigDir()` joined with `"waypaper-engine/themes"`. Resolve once at server startup; store on the server struct.

```go
configDir, err := os.UserConfigDir()
if err == nil {
    s.userThemesDir = filepath.Join(configDir, "waypaper-engine", "themes")
}
```

- [ ] **Step 2: Register routes**

```go
r.Get("/api/themes", s.handleListThemes)
r.Get("/api/themes/{name}.css", s.handleGetTheme)
```

- [ ] **Step 3: Implement handlers**

```go
func (s *Server) handleListThemes(w http.ResponseWriter, r *http.Request) {
    list, err := themes.List(s.userThemesDir)
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(list)
}

func (s *Server) handleGetTheme(w http.ResponseWriter, r *http.Request) {
    name := chi.URLParam(r, "name")
    f, err := themes.Open(s.userThemesDir, name)
    if err != nil {
        http.Error(w, "not found", http.StatusNotFound)
        return
    }
    defer f.Close()
    w.Header().Set("Content-Type", "text/css; charset=utf-8")
    io.Copy(w, f)
}
```

- [ ] **Step 4: Run integration tests**

```bash
cd daemon && go test ./test/... -v
```

If new integration tests are warranted, add one that posts a CSS file to the themes dir, hits `/api/themes`, expects the JSON response to include it, and `/api/themes/{name}.css` to return its bytes.

- [ ] **Step 5: Update API contract**

Add to `daemon/API_CONTRACT.md` under a new "## Themes" section:

```markdown
## Themes

`GET /api/themes` — JSON array of `{ name, displayName, source: "user", url }`.
`GET /api/themes/{name}.css` — `text/css; charset=utf-8` body, or 404.
```

- [ ] **Step 6: Regenerate OpenAPI**

```bash
npm run generate:openapi && npm run generate:types
```

- [ ] **Step 7: Commit**

```bash
git add daemon/ electron/daemon-go-types.generated.ts
git commit -m "feat(daemon): GET /api/themes endpoints with traversal protection"
```

---

## Phase 7 — Renderer: load user themes at startup

### Task 7.1: User-themes Zustand store

**Files:**
- Create: `src/stores/userThemesStore.ts`
- Create: `src/stores/__tests__/userThemesStore.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from "vitest";
import { useUserThemesStore } from "../userThemesStore";

describe("userThemesStore", () => {
  it("starts empty", () => {
    expect(useUserThemesStore.getState().themes).toEqual([]);
  });

  it("loadFromDaemon populates the store", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { name: "neon", displayName: "Neon", source: "user", url: "/api/themes/neon.css" },
      ],
    });
    // @ts-expect-error inject
    globalThis.fetch = fetchMock;

    await useUserThemesStore.getState().loadFromDaemon();
    expect(useUserThemesStore.getState().themes.length).toBe(1);
    expect(useUserThemesStore.getState().themes[0].name).toBe("neon");
  });
});
```

- [ ] **Step 2: Run, see it fail**

```bash
npx vitest run src/stores/__tests__/userThemesStore.test.ts
```

Expected: FAIL (module missing).

- [ ] **Step 3: Implement the store**

```ts
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { UserThemeMeta } from "../styles/themes/types";
import { logger } from "../utils/logger";

interface UserThemesState {
  themes: readonly UserThemeMeta[];
}

interface UserThemesActions {
  loadFromDaemon: () => Promise<void>;
}

export const useUserThemesStore = create<UserThemesState & UserThemesActions>()(
  devtools(
    (set) => ({
      themes: [],
      async loadFromDaemon() {
        try {
          const res = await fetch("/api/themes");
          if (!res.ok) return;
          const list = (await res.json()) as UserThemeMeta[];
          for (const t of list) {
            ensureStylesheetInjected(t);
          }
          set({ themes: list }, false, "loadFromDaemon");
        } catch (e) {
          logger.warn("Failed to load user themes", { error: String(e) });
        }
      },
    }),
    { name: "user-themes" },
  ),
);

function ensureStylesheetInjected(t: UserThemeMeta) {
  const id = `wp-user-theme-${t.name}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = t.url;
  document.head.appendChild(link);
}
```

- [ ] **Step 4: Re-run tests**

```bash
npx vitest run src/stores/__tests__/userThemesStore.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stores/userThemesStore.ts src/stores/__tests__/userThemesStore.test.ts
git commit -m "feat(design): user themes store with daemon fetch + injection"
```

### Task 7.2: Load user themes on app boot

**Files:**
- Modify: `src/main.tsx` (or `App.tsx`, wherever app boot side-effects live)

- [ ] **Step 1: Trigger `loadFromDaemon` once at boot**

In `src/main.tsx`, after the React render call (so the app shows immediately even if the daemon is slow):

```ts
import { useUserThemesStore } from "./stores/userThemesStore";

// Fire-and-forget — user themes are nice-to-have on cold boot.
useUserThemesStore.getState().loadFromDaemon();
```

- [ ] **Step 2: Verify**

Drop a test CSS file into `~/.config/waypaper-engine/themes/test.css`:

```css
@plugin "daisyui/theme" {
  name: "test";
  default: false;
  color-scheme: dark;
  --color-base-100: #001100;
  --color-base-content: #00ff00;
  --color-primary: #00ff00;
}
```

`npm run dev`, in DevTools: `document.documentElement.setAttribute('data-theme', 'test')`. UI should turn matrix-green.

- [ ] **Step 3: Verify CSP allows daemon-served stylesheets**

Electron renderer's CSP (in `electron/main.ts` or wherever `BrowserWindow` is created with `webPreferences`) needs to allow `<link rel="stylesheet">` from the daemon's HTTP origin. Check current CSP:

```bash
grep -rn "Content-Security-Policy\|contentSecurityPolicy\|webPreferences" electron/ 2>/dev/null | head -10
```

If CSP restricts `style-src`, add the daemon origin (typically `http://localhost:<port>` or a `waypaper://` custom protocol). If the daemon is reached via Unix socket bridged through a custom protocol scheme, ensure that scheme is in `style-src`. Test by drop-in CSS file: should render visually after switching to that theme. Look in DevTools Console for any `Refused to apply inline style because…` or `Refused to load the stylesheet…` errors.

- [ ] **Step 4: Commit**

```bash
git add src/main.tsx electron/
git commit -m "feat(design): load user themes from daemon at boot"
```

### Task 7.3: Surface user themes in the picker UI

**Files:**
- Modify: `src/components/settings/InlineThemeSelector.tsx`

- [ ] **Step 1: Compose theme list from both sources**

Replace any direct usage of the old `themes` import with a memoized merge:

```tsx
import { useUserThemesStore } from "../../stores/userThemesStore";
import { builtInThemes } from "../../themes/themes";
import { useMemo } from "react";

const userThemes = useUserThemesStore((s) => s.themes);
const allThemes = useMemo(
  () => [...builtInThemes, ...userThemes],
  [userThemes],
);
```

- [ ] **Step 2: Render the picker as two grouped sections**

```tsx
<>
  <SectionLabel>Built-in</SectionLabel>
  {builtInThemes.map((t) => <ThemeRow key={t.name} theme={t} />)}
  {userThemes.length > 0 && (
    <>
      <SectionLabel>Yours</SectionLabel>
      {userThemes.map((t) => <ThemeRow key={t.name} theme={t} />)}
    </>
  )}
</>
```

(Replace `<SectionLabel>` and `<ThemeRow>` with the existing components from the file; this is illustrative.)

- [ ] **Step 3: Verify**

Drop a user theme CSS as in 7.2; the picker should now show a "Yours" group with that theme. Selecting it should switch the UI.

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/InlineThemeSelector.tsx
git commit -m "feat(design): show user themes in picker grouped under 'Yours'"
```

### Task 7.4: One-page docs for users

**Files:**
- Create: `docs/customization/themes.md`

- [ ] **Step 1: Write a short reference**

```markdown
# Custom themes

Drop a `*.css` file into `~/.config/waypaper-engine/themes/`. Restart the app (or reopen the theme picker) to register it.

A theme file is one DaisyUI v5 `@plugin` block:

```css
@plugin "daisyui/theme" {
  name: "my-theme";       /* used in the picker */
  default: false;
  color-scheme: light;    /* or dark */
  --color-base-100: #ffffff;
  --color-base-200: #f3f3f3;
  --color-base-300: #e6e6e6;
  --color-base-content: #1a1a1a;
  --color-primary: #ff5500;
  --color-primary-content: #ffffff;
  /* ... see daisyui.com/docs/themes */
}
```

The filename (without `.css`) is the theme name in the picker.
```

- [ ] **Step 2: Commit**

```bash
git add docs/customization/themes.md
git commit -m "docs: drop-in custom theme guide"
```

---

## Phase 8 — Build the primitives

Each primitive ships TDD-first.

### Task 8.1: `Surface` primitive

**Files:**
- Create: `src/components/ui/Surface.tsx`
- Create: `src/components/ui/__tests__/Surface.test.tsx`
- Append: `src/styles/tokens.css` with the `.wp-surface` class

- [ ] **Step 1: Write the failing test**

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Surface } from "../Surface";

describe("Surface", () => {
  it("renders children inside a div with .wp-surface", () => {
    const { getByText } = render(<Surface>hello</Surface>);
    const el = getByText("hello");
    expect(el.tagName).toBe("DIV");
    expect(el.className).toContain("wp-surface");
  });

  it("forwards className", () => {
    const { getByText } = render(<Surface className="extra">x</Surface>);
    expect(getByText("x").className).toContain("extra");
  });

  it("supports elevation prop", () => {
    const { getByText } = render(<Surface elevation={2}>y</Surface>);
    expect(getByText("y").className).toContain("wp-surface--elev-2");
  });
});
```

- [ ] **Step 2: Run, fail**

```bash
npx vitest run src/components/ui/__tests__/Surface.test.tsx
```

- [ ] **Step 3: Implement**

```tsx
import { type ReactNode, type HTMLAttributes } from "react";
import clsx from "clsx";

export interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  /** Elevation level (0 = flat, 1-3 increasing). */
  elevation?: 0 | 1 | 2 | 3;
  children?: ReactNode;
}

export function Surface({ elevation = 1, className, children, ...rest }: SurfaceProps) {
  return (
    <div
      className={clsx(
        "wp-surface",
        elevation > 0 && `wp-surface--elev-${elevation}`,
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Add CSS**

Append to `src/styles/tokens.css`:

```css
.wp-surface {
  background: var(--color-base-100);
  color: var(--color-base-content);
  border-radius: var(--wp-radius-md);
  border: var(--wp-border-w) solid var(--wp-border-color);
}
.wp-surface--elev-1 { box-shadow: var(--wp-elev-1); }
.wp-surface--elev-2 { box-shadow: var(--wp-elev-2); }
.wp-surface--elev-3 { box-shadow: var(--wp-elev-3); }
```

- [ ] **Step 5: Pass tests**

```bash
npx vitest run src/components/ui/__tests__/Surface.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/Surface.tsx src/components/ui/__tests__/Surface.test.tsx src/styles/tokens.css
git commit -m "feat(design): Surface primitive"
```

### Task 8.2: `Card` primitive (with optional polaroid frame)

**Files:**
- Create: `src/components/ui/Card.tsx`
- Create: `src/components/ui/__tests__/Card.test.tsx`
- Modify: `src/styles/tokens.css` (`.wp-card`)
- Modify: `src/styles/neobrutalist.css` (`.wp-card--polaroid` neo-only structural rules)

- [ ] **Step 1: Test**

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Card } from "../Card";

vi.mock("../../../stores/designSystemStore", () => ({
  useDesignSystemStore: (sel: any) =>
    sel({ designMode: "default", neoConfig: { polaroidCards: false } }),
}));

describe("Card", () => {
  it("wraps children in .wp-card", () => {
    const { getByText } = render(<Card>x</Card>);
    expect(getByText("x").parentElement?.className).toContain("wp-card");
  });
  it("accepts polaroid prop and renders the polaroid wrapper class", () => {
    const { container } = render(<Card polaroid>x</Card>);
    expect(container.querySelector(".wp-card--polaroid")).not.toBeNull();
  });
});
```

- [ ] **Step 2: Implement**

```tsx
import { type ReactNode, type HTMLAttributes } from "react";
import clsx from "clsx";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Render with a polaroid frame (only visually distinct in neobrutalist mode). */
  polaroid?: boolean;
  /** Elevation. Defaults to 1. */
  elevation?: 0 | 1 | 2 | 3;
  children?: ReactNode;
}

export function Card({
  polaroid = false,
  elevation = 1,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={clsx(
        "wp-card",
        polaroid && "wp-card--polaroid",
        elevation > 0 && `wp-card--elev-${elevation}`,
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 3: CSS — base in `tokens.css`**

```css
.wp-card {
  background: var(--color-base-100);
  color: var(--color-base-content);
  border-radius: var(--wp-radius-md);
  border: var(--wp-border-w) solid var(--wp-border-color);
  overflow: hidden;
}
.wp-card--elev-1 { box-shadow: var(--wp-elev-1); }
.wp-card--elev-2 { box-shadow: var(--wp-elev-2); }
.wp-card--elev-3 { box-shadow: var(--wp-elev-3); }
```

- [ ] **Step 4: CSS — polaroid in `neobrutalist.css`**

Add (or move from existing rules) into the file's structural-only section:

```css
[data-design="neobrutalist"] .wp-card--polaroid {
  padding: 12px 12px 32px;
  background:
    linear-gradient(transparent, oklch(from var(--color-base-content) l c h / 0.04)),
    var(--color-base-100);
}
[data-design="neobrutalist"] .wp-card--polaroid :where(img, video) {
  border: 2px solid oklch(from var(--color-base-content) l c h / 0.1);
}
```

- [ ] **Step 5: Verify, commit**

```bash
npx vitest run src/components/ui/__tests__/Card.test.tsx
git add src/components/ui/Card.tsx src/components/ui/__tests__/Card.test.tsx src/styles/tokens.css src/styles/neobrutalist.css
git commit -m "feat(design): Card primitive with polaroid variant"
```

### Task 8.3: `Modal` primitive (with `Modal.Header`)

**Files:**
- Create: `src/components/ui/Modal/Modal.tsx`
- Create: `src/components/ui/Modal/ModalHeader.tsx`
- Create: `src/components/ui/Modal/index.ts`
- Create: `src/components/ui/Modal/__tests__/Modal.test.tsx`
- Modify: `src/styles/tokens.css` (`.wp-modal`, `.wp-modal__header`)
- Modify: `src/styles/neobrutalist.css` (striped header rule)

- [ ] **Step 1: Test (focus on render shape, props, ESC handling)**

```tsx
import { render, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "../Modal";

describe("Modal", () => {
  it("renders nothing when not open", () => {
    const { container } = render(<Modal open={false} onClose={() => {}}><p>X</p></Modal>);
    expect(container.querySelector(".wp-modal")).toBeNull();
  });
  it("renders content when open", () => {
    const { getByText } = render(<Modal open onClose={() => {}}><p>hi</p></Modal>);
    expect(getByText("hi")).toBeTruthy();
  });
  it("calls onClose on Escape", () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose}><p>x</p></Modal>);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement `Modal.tsx`**

```tsx
import { useEffect, type ReactNode } from "react";
import clsx from "clsx";
import { ModalHeader } from "./ModalHeader";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Maximum width DaisyUI-style: 'sm' | 'md' | 'lg' | 'xl' | undefined (auto) */
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  children?: ReactNode;
}

export function Modal({ open, onClose, size, className, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="wp-modal-backdrop" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={clsx("wp-modal", size && `wp-modal--${size}`, className)}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

Modal.Header = ModalHeader;
```

- [ ] **Step 3: Implement `ModalHeader.tsx`**

```tsx
import { type ReactNode } from "react";
import clsx from "clsx";

export interface ModalHeaderProps {
  variant?: "plain" | "striped";
  className?: string;
  children?: ReactNode;
}

export function ModalHeader({ variant = "plain", className, children }: ModalHeaderProps) {
  return (
    <header className={clsx("wp-modal__header", variant === "striped" && "wp-modal__header--striped", className)}>
      {children}
    </header>
  );
}
```

- [ ] **Step 4: Re-export**

`src/components/ui/Modal/index.ts`:

```ts
export { Modal } from "./Modal";
export type { ModalProps } from "./Modal";
export { ModalHeader } from "./ModalHeader";
export type { ModalHeaderProps } from "./ModalHeader";
```

- [ ] **Step 5: CSS in `tokens.css`**

```css
.wp-modal-backdrop {
  position: fixed; inset: 0;
  background: oklch(0 0 0 / 0.4);
  backdrop-filter: blur(4px);
  display: grid; place-items: center;
  z-index: 50;
}
.wp-modal {
  background: var(--color-base-100);
  color: var(--color-base-content);
  border-radius: var(--wp-radius-lg);
  border: var(--wp-border-w) solid var(--wp-border-color);
  box-shadow: var(--wp-elev-3);
  padding: 1.5rem;
  max-width: min(90vw, 32rem);
  max-height: 90vh;
  overflow: auto;
}
.wp-modal--sm { max-width: min(90vw, 24rem); }
.wp-modal--lg { max-width: min(90vw, 48rem); }
.wp-modal--xl { max-width: min(90vw, 72rem); }

.wp-modal__header {
  display: flex; align-items: center; justify-content: space-between;
  margin: -1.5rem -1.5rem 1rem;
  padding: 1rem 1.5rem;
}
```

- [ ] **Step 6: Striped header rule in `neobrutalist.css`**

```css
[data-design="neobrutalist"] .wp-modal__header--striped {
  background: repeating-linear-gradient(
    -45deg,
    oklch(from var(--color-base-content) l c h / 0.08) 0 8px,
    transparent 8px 16px
  );
  border-bottom: var(--wp-border-w) solid var(--wp-border-color);
}
```

- [ ] **Step 7: Verify, commit**

```bash
npx vitest run src/components/ui/Modal/__tests__/Modal.test.tsx
git add src/components/ui/Modal/ src/styles/tokens.css src/styles/neobrutalist.css
git commit -m "feat(design): Modal primitive with Modal.Header subcomponent"
```

### Task 8.4: `Button` primitive

**Files:**
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/__tests__/Button.test.tsx`
- Modify: `src/styles/tokens.css` (`.wp-btn` class — wraps DaisyUI `.btn`)

- [ ] **Step 1: Test**

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "../Button";

describe("Button", () => {
  it("renders a <button> with .btn .wp-btn", () => {
    const { getByRole } = render(<Button>OK</Button>);
    const b = getByRole("button");
    expect(b.className).toContain("btn");
    expect(b.className).toContain("wp-btn");
  });
  it("supports variant=primary", () => {
    const { getByRole } = render(<Button variant="primary">Go</Button>);
    expect(getByRole("button").className).toContain("btn-primary");
  });
});
```

- [ ] **Step 2: Implement**

```tsx
import { type ButtonHTMLAttributes } from "react";
import clsx from "clsx";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "accent" | "ghost" | "neutral" | undefined;
  size?: "xs" | "sm" | "md" | "lg";
  block?: boolean;
}

export function Button({
  variant,
  size,
  block,
  className,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx(
        "btn wp-btn",
        variant && `btn-${variant}`,
        size && `btn-${size}`,
        block && "btn-block",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 3: CSS in `tokens.css`**

```css
.wp-btn {
  border-radius: var(--wp-radius-md);
  font-family: var(--font-display);
  font-weight: var(--wp-display-weight);
  letter-spacing: var(--wp-display-tracking);
  text-transform: var(--wp-display-case);
}
```

The neobrutalist `:active` translate / hover-shadow-amplify rules already live in `neobrutalist.css` keyed on `.btn`; they keep working.

- [ ] **Step 4: Verify, commit**

```bash
npx vitest run src/components/ui/__tests__/Button.test.tsx
git add src/components/ui/Button.tsx src/components/ui/__tests__/Button.test.tsx src/styles/tokens.css
git commit -m "feat(design): Button primitive (DaisyUI .btn + display tokens)"
```

### Task 8.5: `IconButton` and `CloseButton`

**Files:**
- Create: `src/components/ui/IconButton.tsx`
- Create: `src/components/ui/CloseButton.tsx`
- Create: `src/components/ui/__tests__/IconButton.test.tsx`
- Modify: `src/styles/tokens.css` (`.wp-icon-btn`, `.wp-close-btn`)
- Modify: `src/styles/neobrutalist.css` (move existing `.neo-close-btn` rules to `.wp-close-btn` keyed on `[data-design="neobrutalist"]`)

- [ ] **Step 1: Test**

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IconButton } from "../IconButton";

describe("IconButton", () => {
  it("renders with .wp-icon-btn", () => {
    const { getByRole } = render(<IconButton aria-label="x"><span/></IconButton>);
    expect(getByRole("button").className).toContain("wp-icon-btn");
  });
});
```

- [ ] **Step 2: Implement `IconButton.tsx`**

```tsx
import { type ButtonHTMLAttributes } from "react";
import clsx from "clsx";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "sm" | "md" | "lg";
}

export function IconButton({ size = "md", className, type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      className={clsx("wp-icon-btn", `wp-icon-btn--${size}`, className)}
      {...rest}
    />
  );
}
```

- [ ] **Step 3: Implement `CloseButton.tsx`**

```tsx
import { type ButtonHTMLAttributes } from "react";
import clsx from "clsx";

export interface CloseButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {}

export function CloseButton({ className, type = "button", ...rest }: CloseButtonProps) {
  return (
    <button
      type={type}
      aria-label={rest["aria-label"] ?? "Close"}
      className={clsx("wp-close-btn", className)}
      {...rest}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
        <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="2" />
      </svg>
    </button>
  );
}
```

- [ ] **Step 4: CSS — base in `tokens.css`**

```css
.wp-icon-btn {
  display: inline-flex; align-items: center; justify-content: center;
  background: transparent;
  color: var(--color-base-content);
  border: var(--wp-border-w) solid transparent;
  border-radius: var(--wp-radius-md);
  cursor: pointer;
  padding: 6px;
  transition: background var(--wp-dur-fast) var(--wp-ease-out);
}
.wp-icon-btn:hover { background: oklch(from var(--color-base-content) l c h / 0.08); }
.wp-icon-btn--sm { padding: 4px; }
.wp-icon-btn--lg { padding: 8px; }

.wp-close-btn {
  composes: from "wp-icon-btn"; /* if your bundler supports it; else duplicate */
}
.wp-close-btn { /* fallback if composes unavailable */
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--color-base-100);
  color: var(--color-base-content);
  border: var(--wp-border-w) solid var(--wp-border-color);
  border-radius: var(--wp-radius-md);
  cursor: pointer;
  padding: 6px;
  width: 32px; height: 32px;
}
```

(If `composes:` isn't supported by the project's CSS pipeline, just duplicate the rules; they're short.)

- [ ] **Step 5: Move neo-specific rules from `neobrutalist.css`**

Find the existing `.neo-close-btn` block (around the top of the file) and rename it to `.wp-close-btn`, key it to `[data-design="neobrutalist"]`:

```css
[data-design="neobrutalist"] .wp-close-btn {
  position: absolute;
  top: -0.75rem;
  right: -0.75rem;
  background: var(--color-base-100);
  border: var(--wp-border-w) solid var(--color-base-content);
  box-shadow: 4px 4px 0 0 #000;
  /* ...rest of existing neo close-btn styling... */
}
```

- [ ] **Step 6: Verify, commit**

```bash
npx vitest run src/components/ui/__tests__/IconButton.test.tsx
git add src/components/ui/IconButton.tsx src/components/ui/CloseButton.tsx src/components/ui/__tests__/IconButton.test.tsx src/styles/tokens.css src/styles/neobrutalist.css
git commit -m "feat(design): IconButton and CloseButton primitives"
```

### Task 8.6: Barrel re-export

**Files:**
- Create: `src/components/ui/index.ts`

- [ ] **Step 1: Author**

```ts
export { Surface } from "./Surface";
export type { SurfaceProps } from "./Surface";
export { Card } from "./Card";
export type { CardProps } from "./Card";
export { Modal, ModalHeader } from "./Modal";
export type { ModalProps, ModalHeaderProps } from "./Modal";
export { Button } from "./Button";
export type { ButtonProps } from "./Button";
export { IconButton } from "./IconButton";
export type { IconButtonProps } from "./IconButton";
export { CloseButton } from "./CloseButton";
export type { CloseButtonProps } from "./CloseButton";
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/index.ts
git commit -m "feat(design): barrel-export primitives from components/ui"
```

---

## Phase 9 — Migrate consumers

### Task 9.1: Migrate `NeoCloseButton` → `CloseButton`

**Files:**
- Delete: `src/components/NeoCloseButton.tsx`
- Modify: every consumer that imports `NeoCloseButton`

- [ ] **Step 1: Find consumers**

```bash
grep -rn "NeoCloseButton" src --include="*.tsx" --include="*.ts" | grep -v __tests__ | grep -v NeoCloseButton.tsx
```

- [ ] **Step 2: Replace each import & usage**

For each file: replace `import { NeoCloseButton } from "../NeoCloseButton";` (path varies) with `import { CloseButton } from "./ui";` (path varies). Replace `<NeoCloseButton ... />` with `<CloseButton ... />`. Drop any explicit `isNeo`/`useIsNeo` props on the call sites.

- [ ] **Step 3: Delete the old component**

```bash
git rm src/components/NeoCloseButton.tsx
```

- [ ] **Step 4: Verify, commit**

```bash
npx tsc --noEmit && npm test
git add -A
git commit -m "refactor(design): replace NeoCloseButton with CloseButton primitive"
```

### Task 9.2: Migrate modals — one per commit

For each modal in this list, do the **same set of steps**:

1. Replace the outer `<div className="modal">...<div className="modal-box">` markup with `<Modal open={...} onClose={...}>`.
2. If the modal had a `ModalStripedHeader`, replace with `<Modal.Header variant="striped">...</Modal.Header>`.
3. Remove `useIsNeo`/`isNeo` from the file (the primitive owns the mode-switching).
4. Buttons inside become `<Button variant="primary">` etc.
5. Run `npx tsc --noEmit && npm test`.
6. Commit: `refactor(design): migrate <ComponentName> to Modal primitive`.

Modals to migrate (in this order — small ones first):

- [ ] `ConfirmDialog`
- [ ] `FolderPickerModal`
- [ ] `MonitorsModal`
- [ ] `LoadPlaylistModal`
- [ ] `SavePlaylistModal`
- [ ] `AddToPlaylistModal`
- [ ] `GalleryFilterCheatsheetModal`
- [ ] `AdvancedFiltersModal`
- [ ] `FolderImportModal`
- [ ] `PlaylistConfigurationModal`
- [ ] `SettingsModal`

After all eleven: delete `src/components/ModalStripedHeader.tsx` (its callers now use `<Modal.Header variant="striped">`).

```bash
git rm src/components/ModalStripedHeader.tsx
git commit -m "refactor(design): drop ModalStripedHeader (folded into Modal.Header)"
```

### Task 9.3: Migrate cards

- [ ] **Step 1: `FolderCard`** → wrap frame in `<Card polaroid={isPolaroidEnabled}>`. Remove `useIsNeo`. Mode-aware polaroid logic moves to reading the `polaroidCards` flag from `useDesignSystemStore` and passing `polaroid={...}` to `<Card>`. Commit: `refactor(design): migrate FolderCard to Card primitive`.

- [ ] **Step 2: `MiniPlaylistCard`** → wrap in `<Card>`. Drop `useIsNeo`. Commit: `refactor(design): migrate MiniPlaylistCard to Card primitive`.

- [ ] **Step 3: `ImageCard`** → wrap the frame element in `<Card polaroid={isPolaroidEnabled}>`. The image markup, hover transforms and metadata logic stay exactly as they are — `<Card>` is just a frame replacement. Verify the gallery in both modes; pay attention to the polaroid hover transform from `neobrutalist.css`. Commit: `refactor(design): migrate ImageCard frame to Card primitive`.

### Task 9.4: Migrate `MonitorButton` → `IconButton`

- [ ] **Step 1:** Replace the outer button element with `<IconButton aria-label="...">`. Drop `useIsNeo`. Commit: `refactor(design): migrate MonitorButton to IconButton primitive`.

### Task 9.5: Token-only conversions (drop `useIsNeo` outright)

For each of these files, the only change is replacing `isNeo ? "<neo classes>" : "<modern classes>"` with a single class stack that uses tokens. The general substitution rules:

- `isNeo ? "rounded-none" : "rounded-box"` → drop entirely; DaisyUI `.btn`/`.modal-box` already use `--radius-*` which the neo mode overrides via `tokens.css`.
- `isNeo ? "border-4 border-base-content/20" : "border border-base-300"` → custom: replace with a single class like `wp-bordered` or use `border-[var(--wp-border-w)] border-[var(--wp-border-color)]` in Tailwind v4 arbitrary syntax.
- `isNeo ? "uppercase tracking-wider font-extrabold" : ""` → drop; this is now governed by `--wp-display-*` tokens applied to headings/buttons globally.

For each file:

1. Find every `useIsNeo`/`isNeo` reference. Replace each branch with a single class stack.
2. Remove the `useIsNeo` import and the `const isNeo = useIsNeo();` line.
3. Verify `npx tsc --noEmit && npm test`.
4. Commit one file at a time: `refactor(design): drop useIsNeo from <File>`.

Files (do these in order, smallest first to build confidence):

- [ ] `LoopStudioYtDlpBanner`
- [ ] `MonitorButton` (already migrated to IconButton in 9.4 — re-verify no lingering useIsNeo)
- [ ] `PlaylistTrack`
- [ ] `MiniPlaylistCard` (re-verify after card migration)
- [ ] `BottomDock`
- [ ] `Filters`
- [ ] `ImageDetailSidebar`
- [ ] `PlaylistController`
- [ ] `InlineThemeSelector`
- [ ] `AppSettingsSection`
- [ ] `SettingsTabs`
- [ ] `History` (route)
- [ ] `LoopStudio` (route)
- [ ] `ShaderStudio` (route)
- [ ] `Wallhaven` (route)
- [ ] `ModernSidebar`

### Task 9.6: Verify final consumer count

- [ ] **Step 1: Confirm only 5 files reference `useIsNeo`**

```bash
grep -rln "useIsNeo\|isNeo\b" src --include="*.tsx" --include="*.ts" | grep -v __tests__ | grep -v useIsNeo.ts
```

Expected output (5 files):

```
src/components/ui/Card.tsx                  # reads polaroidCards from store; may not need useIsNeo directly
src/components/ui/Modal/Modal.tsx           # only if necessary; ideally CSS-driven
src/components/ui/Button.tsx                # ideally CSS-driven
src/components/ui/CloseButton.tsx           # ideally CSS-driven
src/components/ContextMenu.tsx              # genuinely structural (different markup paths)
```

If any primitive *doesn't actually need* `useIsNeo` (because its differences are pure CSS), drop the hook from it. The number should land at **3-5 files**.

- [ ] **Step 2: Update tests**

`src/components/__tests__/ImageCard.test.tsx` and `src/components/__tests__/ModernAppLayout.test.tsx` reference `useIsNeo`. Update them to either mock `useDesignSystemStore` directly or to render under both modes.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test(design): update isNeo-touching tests post-migration"
```

---

## Phase 10 — Cleanup

### Task 10.1: Shrink `neobrutalist.css`

**Files:**
- Modify: `src/styles/neobrutalist.css`

- [ ] **Step 1: Audit what's still consumed**

```bash
grep -rn "data-design=\"neobrutalist\"\|\.neo-" src --include="*.tsx" --include="*.ts" --include="*.css" | head -40
```

- [ ] **Step 2: Delete redundant blocks**

Remove any rule that mutates radius, border-width, plain shadow, or font-casing for a generic DaisyUI class — those are now handled by the `--wp-*` tokens DaisyUI reads. Keep:

- The token-override block at the top (`--wp-shadow-*`, `--wp-border-*`, `--wp-radius-*`, `--font-display`) — actually this should now live in `tokens.css` per Task 1.1, not here. Confirm and remove from `neobrutalist.css` if duplicated.
- `.wp-card--polaroid` neo-only rules (Task 8.2).
- `.wp-modal__header--striped` rule (Task 8.3).
- `[data-design="neobrutalist"] .wp-close-btn` rule (Task 8.5).
- `:active` translate behavior for `.btn`, `.input`, `.select`, `.textarea` — these are intrinsic to neobrutalism and don't tokenize cleanly.
- `.context-menu` neo variant if `ContextMenu.tsx` renders a different markup path under `[data-design="neobrutalist"]`.

- [ ] **Step 3: Confirm size**

```bash
wc -l src/styles/neobrutalist.css
```

Target: under 300 lines.

- [ ] **Step 4: Verify**

`npm run dev`, switch to neobrutalist mode, click through all migrated screens (gallery, every modal, settings, playlist controller). Compare to a screenshot taken before this work — visuals should match.

- [ ] **Step 5: Commit**

```bash
git add src/styles/neobrutalist.css
git commit -m "refactor(design): shrink neobrutalist.css to structural-only rules"
```

### Task 10.2: Delete unused theme-transition utilities

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Confirm none consumed**

```bash
grep -rn "theme-transition\b\|theme-transition-fast\|theme-transition-slow\|disable-transitions\|theme-scrollbar\|theme-focus-ring\|theme-selection\|theme-dark\|theme-light" src --include="*.tsx" --include="*.ts"
```

If matches exist, audit them: many will be inside `index.css` itself defining the rule, not consumers. Genuine consumers must be migrated to either `wp-theme-transition` or removed.

- [ ] **Step 2: Delete unused class definitions from `index.css`**

Remove blocks for `.theme-transition`, `.theme-transition-fast`, `.theme-transition-slow`, `.disable-transitions`, `.theme-scrollbar*`, `.theme-focus-ring`, `.theme-selection`, `.theme-dark`, `.theme-light` (all currently around lines 738-780, 822-857).

Keep `.wp-theme-transition` (Task 1's neighbor) — that one is actually used.

- [ ] **Step 3: Verify**

`npm run dev`, click through screens. No visual change expected.

- [ ] **Step 4: Commit**

```bash
git add src/index.css
git commit -m "chore(design): remove unused theme-transition / scrollbar utility classes"
```

### Task 10.3: Verify scrollbar — keep one system

**Files:**
- Modify: `src/index.css` (audit only)

- [ ] **Step 1: Keep the global `::-webkit-scrollbar` block** (the "thin-to-expand on hover" one around lines 781-820). Delete the `.theme-scrollbar` variant block if it wasn't already removed in 10.2.

- [ ] **Step 2: Commit if anything changed.**

### Task 10.4: Drop the legacy `themes.ts` shape

**Files:**
- Audit: `src/themes/themes.ts` (already simplified in Task 3.5; delete remaining cruft if any)
- Audit: `src/themes/types.ts`

- [ ] **Step 1: Check no `ThemeConfig` references remain**

```bash
grep -rn "ThemeConfig\b" src --include="*.ts" --include="*.tsx"
```

Expected: 0.

- [ ] **Step 2: Delete the legacy types file if all migrated**

If `src/themes/types.ts` only re-exports types from `src/styles/themes/types.ts`, leave it as a re-export hub (consumers may rely on the path). Otherwise delete and update imports.

- [ ] **Step 3: Commit if changes made**

```bash
git commit -am "chore(design): remove dead theme-config types"
```

---

## Phase 11 — Settings UI: design mode + tokens visualizer (optional polish)

### Task 11.1: Surface design mode toggle in settings

**Files:**
- Modify: `src/components/settings/sections/AppSettingsSection.tsx`

- [ ] **Step 1: Confirm a `design mode` selector already exists** (it does — toggles between `default` and `neobrutalist` via `setDesignMode`). Rename the labels so the user-facing text reflects the new vocabulary: `default` → "Modern", `neobrutalist` → "Neobrutalist". Internal store value stays `default`/`neobrutalist` to avoid migration risk.

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(design): rename mode label 'default' to 'Modern' in settings"
```

### Task 11.2: (Optional) live tweakers for neo knobs

The `designSystemStore` already tracks `shadowOffsetX/Y`, `borderWidth`, `cornerRadius`, `polaroidCards`. Settings UI may already expose these. If not, add sliders bound to `updateNeoConfig`. Skip if the user wants to defer.

---

## Phase 12 — Final verification

### Task 12.1: Full CI gate

- [ ] **Step 1: Run the project's CI check**

```bash
npm run ci:check
```

Expected: PASS (gofmt, oxfmt, oxlint, tsc, vitest, daemon unit tests, vite build).

- [ ] **Step 2: Run e2e if available**

```bash
npm run test:e2e
```

If it fails because of mode-related visual regression, capture screenshots, decide if the new look is correct vs. the snapshot, update snapshots if so.

### Task 12.2: Manual smoke

Open the dev app and walk through:

- [ ] Switch through each built-in palette in the picker — confirm visuals match expectations.
- [ ] Drop a CSS file into `~/.config/waypaper-engine/themes/` — confirm it appears under "Yours" and selects.
- [ ] Toggle Modern ↔ Neobrutalist for three palettes (light, dark, 80s-vibe). Confirm:
  - Aldrich + uppercase headings appear in neo, vanish in modern.
  - Hard 8/8 black shadow on cards/buttons in neo, soft elevation in modern.
  - Modal backdrop has blur in neo + modern.
  - Gallery's paper grid is visible in both modes; slightly stronger in neo.
  - Polaroid frame appears on cards in neo when `polaroidCards` is on.
  - Striped modal header appears in neo on modals that opt in.
  - Modal Esc key closes modal.

### Task 12.3: Compose final commit on `refactor/waypaper-engine`

- [ ] **Step 1: Rebase / squash the work into clean commits if you took sub-branches** (otherwise the per-task commits already form a clean history).

- [ ] **Step 2: Push**

```bash
git push origin refactor/waypaper-engine
```

---

## Appendix A — Files touched

| Created | Modified | Deleted |
|---|---|---|
| `src/styles/themes/*.css` (~30 files) | `src/styles/tokens.css` | `src/utils/paperGridBackground.ts` |
| `src/styles/themes/types.ts` | `src/styles/neobrutalist.css` | `src/themes/themes.ts` (replaced) |
| `src/styles/themes/_index.ts` (generated) | `src/index.css` | `src/components/NeoCloseButton.tsx` |
| `scripts/vite-plugin-theme-registry.ts` | `vite.config.ts` | `src/components/ModalStripedHeader.tsx` |
| `src/components/ui/Surface.tsx` | `src/themes/themes.ts` (rewrite) | `daemon/internal/themes/` (new pkg) |
| `src/components/ui/Card.tsx` | `src/themes/types.ts` | |
| `src/components/ui/Modal/{Modal,ModalHeader,index}.tsx` | `src/main.tsx` | |
| `src/components/ui/Button.tsx` | `src/components/Gallery.tsx` | |
| `src/components/ui/IconButton.tsx` | `src/components/StartupIntro.tsx` | |
| `src/components/ui/CloseButton.tsx` | 31 components (Phase 9) | |
| `src/components/ui/index.ts` | `src/components/settings/InlineThemeSelector.tsx` | |
| `src/stores/userThemesStore.ts` | `src/components/settings/sections/AppSettingsSection.tsx` | |
| `daemon/internal/themes/themes.go` | `daemon/cmd/daemon/main.go` (route registration) | |
| `daemon/internal/themes/themes_test.go` | `daemon/API_CONTRACT.md` | |
| `docs/customization/themes.md` | | |

## Appendix B — Useful greps

```bash
# Confirm all useIsNeo consumers post-migration
grep -rln "useIsNeo\|isNeo\b" src --include="*.tsx" --include="*.ts" | grep -v __tests__ | grep -v useIsNeo.ts

# Confirm all palette plugin blocks moved out of index.css
grep -c '@plugin "daisyui/theme"' src/index.css

# Confirm all themes are file-based
ls src/styles/themes/*.css | wc -l

# Confirm primitive coverage in components/ui
ls src/components/ui/

# Confirm registry is generated, up-to-date
cat src/styles/themes/_index.ts | head -20
```
