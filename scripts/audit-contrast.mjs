/**
 * scripts/audit-contrast.mjs
 *
 * Dev-only WCAG contrast audit for waypaper-engine themes.
 * Usage: pnpm run audit:contrast
 *
 * For each theme CSS file, parses DaisyUI-style custom properties, then computes
 * WCAG 2.1 contrast ratios for key role-token pairs. Outputs a human-readable table
 * and writes audit-contrast.json for diffing.
 *
 * Exit code is always 0 — this is NOT gated in CI.
 */

import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// culori provides accurate OKLCH → sRGB conversions
import { parse as culoriParse, wcagContrast, toGamut, formatHex, converter } from "culori";

const toOklch = converter("oklch");

const __dirname = dirname(fileURLToPath(import.meta.url));
const THEMES_DIR = join(__dirname, "..", "src", "styles", "themes");
const OUTPUT_FILE = join(__dirname, "..", "audit-contrast.json");

// ── Theme file discovery ────────────────────────────────────────────────────

function enumerateThemeFiles() {
  return readdirSync(THEMES_DIR)
    .filter((f) => f.endsWith(".css") && !f.startsWith("_"))
    .map((f) => join(THEMES_DIR, f));
}

// ── CSS variable parser ─────────────────────────────────────────────────────

/**
 * Parses `--color-*` custom properties from a DaisyUI theme CSS file.
 * Returns a map of { '--color-base-100': 'oklch(...)' , ... }
 */
function parseThemeVars(css) {
  const vars = {};
  // Match --some-var: value; inside @plugin blocks or :root blocks
  const re = /--[\w-]+\s*:\s*[^;]+;/g;
  const matches = css.matchAll(re);
  for (const m of matches) {
    const [full] = m;
    const colonIdx = full.indexOf(":");
    const name = full.slice(0, colonIdx).trim();
    const value = full.slice(colonIdx + 1).replace(";", "").trim();
    vars[name] = value;
  }
  return vars;
}

/**
 * Extracts the theme name from the `name: "xxx";` directive in the CSS.
 */
function parseThemeName(css, filePath) {
  const nameMatch = css.match(/name:\s*["']([^"']+)["']/);
  if (nameMatch) return nameMatch[1];
  // Fall back to filename
  return filePath.replace(/^.*\//, "").replace(/\.css$/, "");
}

// ── Color resolution ────────────────────────────────────────────────────────

/**
 * Attempts to parse a CSS color string (oklch, hex, rgb, hsl, etc.) via culori.
 * Returns a culori color object or null.
 */
function resolveColor(value) {
  if (!value) return null;
  const trimmed = value.trim();
  try {
    const parsed = culoriParse(trimmed);
    return parsed ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolves a computed color token string that may reference other vars via
 * `oklch(from var(...) l c h / alpha)` relative color syntax.
 * Supports the two tokens used in tokens.css:
 *   --wp-text-muted: oklch(from var(--color-base-content) l c h / 0.72)
 *   --wp-text-faint: oklch(from var(--color-base-content) l c h / 0.55)
 */
function resolveRelativeOklch(expression, vars) {
  // Match: oklch(from var(--something) l c h / alpha)
  const relRe =
    /^oklch\(\s*from\s+var\(\s*(--[\w-]+)\s*\)\s+l\s+c\s+h\s*\/\s*([\d.]+)\s*\)$/i;
  const m = expression.trim().match(relRe);
  if (!m) return null;
  const [, varName, alphaStr] = m;
  const baseValue = vars[varName];
  if (!baseValue) return null;
  const base = resolveColor(baseValue);
  if (!base) return null;
  const alpha = parseFloat(alphaStr);
  // Convert to oklch space and apply alpha
  const oklchBase = culoriParse(`oklch(${base.l ?? 0} ${base.c ?? 0} ${base.h ?? 0})`);
  if (!oklchBase) return null;
  return { ...oklchBase, mode: "oklch", alpha };
}

/**
 * Get a resolved culori color from vars, with fallback for relative oklch syntax.
 * Always converts to oklch mode to ensure l/c/h properties are available.
 */
function getColor(name, vars) {
  const value = vars[name];
  if (!value) return null;
  // Try direct parse first
  const direct = resolveColor(value);
  if (direct) {
    // Convert to oklch so that l/c/h properties are always available
    const oklch = toOklch(direct);
    return oklch ?? direct;
  }
  // Try relative oklch resolution
  return resolveRelativeOklch(value, vars);
}

// ── Alpha compositing ───────────────────────────────────────────────────────

/**
 * If the foreground color has an alpha < 1, composite it onto the background
 * before computing contrast ratio (WCAG 2.1 requires opaque colors).
 */
function compositeOnto(fg, bg) {
  if (!fg || !bg) return fg;
  const alpha = fg.alpha ?? 1;
  if (alpha >= 1) return fg;
  // Blend in sRGB-like space using alpha compositing
  // Coerce both to an oklch-adjacent object for blending
  const parse = (c) => culoriParse(`oklch(${c.l ?? 0} ${c.c ?? 0} ${c.h ?? 0})`);
  const fgBase = parse(fg);
  const bgBase = parse(bg);
  if (!fgBase || !bgBase) return fg;
  return {
    mode: "oklch",
    l: fgBase.l * alpha + (bgBase.l ?? 0) * (1 - alpha),
    c: fgBase.c * alpha + (bgBase.c ?? 0) * (1 - alpha),
    h: fgBase.h ?? bgBase.h ?? 0,
    alpha: 1,
  };
}

// ── WCAG contrast ratio ─────────────────────────────────────────────────────

function wcagRatio(colorA, colorB) {
  if (!colorA || !colorB) return null;
  try {
    // Composite alpha foreground onto background before comparing
    const resolvedA = compositeOnto(colorA, colorB);
    const ratio = wcagContrast(resolvedA, colorB);
    return Math.round(ratio * 100) / 100;
  } catch {
    return null;
  }
}

// ── Compute tokens.css synthetic vars ──────────────────────────────────────

/**
 * Add the synthetic wp tokens to the vars map by evaluating them against the
 * parsed theme variables.
 */
function addWpTokens(vars) {
  const enriched = { ...vars };

  // --wp-surface-3: color-mix(in oklch, --color-base-100 84%, --color-base-content 16%)
  // Approximate: lerp base-100 and base-content at 84/16
  const base100 = getColor("--color-base-100", vars);
  const baseContent = getColor("--color-base-content", vars);

  if (base100 && baseContent) {
    // Simple linear interpolation in oklch for wp-surface-3
    const l = (base100.l ?? 0) * 0.84 + (baseContent.l ?? 0) * 0.16;
    const c = (base100.c ?? 0) * 0.84 + (baseContent.c ?? 0) * 0.16;
    const h = base100.h ?? baseContent.h ?? 0;
    enriched["--wp-surface-3"] = `oklch(${l} ${c} ${h})`;
    enriched["--wp-surface-2"] = `oklch(${(base100.l ?? 0) * 0.92 + (baseContent.l ?? 0) * 0.08} ${(base100.c ?? 0) * 0.92 + (baseContent.c ?? 0) * 0.08} ${h})`;
  }

  // --wp-text-muted: oklch(from --color-base-content l c h / 0.72)
  if (baseContent) {
    const l = baseContent.l ?? 0;
    const c = baseContent.c ?? 0;
    const h = baseContent.h ?? 0;
    enriched["--wp-text-muted"] = `oklch(${l} ${c} ${h} / 0.72)`;
    enriched["--wp-text-faint"] = `oklch(${l} ${c} ${h} / 0.55)`;
  }

  // DaisyUI alert colors (info/success/warning/error backgrounds)
  // alert-info uses --color-info as tint
  enriched["--alert-info-bg"] = vars["--color-info"] ?? null;
  enriched["--alert-success-bg"] = vars["--color-success"] ?? null;
  enriched["--alert-warning-bg"] = vars["--color-warning"] ?? null;
  enriched["--alert-error-bg"] = vars["--color-error"] ?? null;

  // alert text colors (info-content etc.)
  enriched["--alert-info-fg"] = vars["--color-info-content"] ?? null;
  enriched["--alert-success-fg"] = vars["--color-success-content"] ?? null;
  enriched["--alert-warning-fg"] = vars["--color-warning-content"] ?? null;
  enriched["--alert-error-fg"] = vars["--color-error-content"] ?? null;

  return enriched;
}

// ── Pairs to check ──────────────────────────────────────────────────────────

const BODY_PAIRS = [
  { id: "body/base-100", fg: "--color-base-content", bg: "--color-base-100" },
  { id: "muted/base-100", fg: "--wp-text-muted", bg: "--color-base-100" },
  { id: "faint/base-100", fg: "--wp-text-faint", bg: "--color-base-100" },
  { id: "body/surface-2", fg: "--color-base-content", bg: "--wp-surface-2" },
  { id: "body/surface-3", fg: "--color-base-content", bg: "--wp-surface-3" },
];

const ALERT_PAIRS = [
  { id: "kbd/alert-info", fg: "--color-info-content", bg: "--color-info" },
  { id: "kbd/alert-success", fg: "--color-success-content", bg: "--color-success" },
  { id: "kbd/alert-warning", fg: "--color-warning-content", bg: "--color-warning" },
  { id: "kbd/alert-error", fg: "--color-error-content", bg: "--color-error" },
];

// ── Formatting helpers ──────────────────────────────────────────────────────

const PASS_AA_BODY = 4.5;
const PASS_AA_LARGE = 3.0;

function passLabel(ratio, threshold) {
  if (ratio === null) return "N/A    ";
  return ratio >= threshold ? `PASS(${ratio})` : `FAIL(${ratio})`;
}

// ── Main ────────────────────────────────────────────────────────────────────

const themeFiles = enumerateThemeFiles();

const rows = [];

for (const filePath of themeFiles) {
  const css = readFileSync(filePath, "utf8");
  const themeName = parseThemeName(css, filePath);
  const rawVars = parseThemeVars(css);
  const vars = addWpTokens(rawVars);

  for (const pair of [...BODY_PAIRS, ...ALERT_PAIRS]) {
    const fg = getColor(pair.fg, vars);
    const bg = getColor(pair.bg, vars);
    const ratio = wcagRatio(fg, bg);
    const threshold = ALERT_PAIRS.includes(pair) ? PASS_AA_LARGE : PASS_AA_BODY;
    rows.push({
      theme: themeName,
      pair: pair.id,
      ratio,
      threshold,
      pass: ratio !== null ? ratio >= threshold : null,
    });
  }
}

// ── Print table ─────────────────────────────────────────────────────────────

const COL = {
  theme: 28,
  pair: 22,
  ratio: 8,
  result: 16,
};

function pad(s, n) {
  return String(s ?? "N/A").padEnd(n);
}

console.log(
  `\n${"Theme".padEnd(COL.theme)} ${"Pair".padEnd(COL.pair)} ${"Ratio".padEnd(COL.ratio)} Result`,
);
console.log("─".repeat(COL.theme + COL.pair + COL.ratio + COL.result + 3));

let prevTheme = "";
for (const row of rows) {
  if (row.theme !== prevTheme) {
    prevTheme = row.theme;
  }
  const result =
    row.pass === null
      ? "N/A"
      : row.pass
        ? `PASS  (≥${row.threshold})`
        : `FAIL  (<${row.threshold})`;
  const ratio = row.ratio !== null ? row.ratio.toFixed(2) : "N/A";
  console.log(`${pad(row.theme, COL.theme)} ${pad(row.pair, COL.pair)} ${pad(ratio, COL.ratio)} ${result}`);
}

// ── Summary ─────────────────────────────────────────────────────────────────

const fails = rows.filter((r) => r.pass === false);
console.log(
  `\n${rows.length} pairs checked across ${themeFiles.length} themes. ${fails.length} fail WCAG AA.\n`,
);
if (fails.length > 0) {
  console.log("Failing pairs:");
  for (const f of fails) {
    console.log(`  ${f.theme.padEnd(28)} ${f.pair.padEnd(22)} ratio=${f.ratio?.toFixed(2) ?? "N/A"}`);
  }
  console.log();
}

// ── Write JSON ──────────────────────────────────────────────────────────────

writeFileSync(OUTPUT_FILE, JSON.stringify(rows, null, 2));
console.log(`Wrote ${OUTPUT_FILE}\n`);

// Always exit 0 — dev-only, not CI-gated
process.exit(0);
