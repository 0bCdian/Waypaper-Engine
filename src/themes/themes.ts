import type { BuiltinThemeMeta, ThemeMeta } from "../styles/themes/types";
import { builtInThemes } from "../styles/themes/_index";
import { daisyStockThemeMetas } from "./daisyStockThemes";

export type { BuiltinThemeMeta, ThemeMeta };
export { builtInThemes, daisyStockThemeMetas };

const auditedThemeNames = new Set(builtInThemes.map((t) => t.name));

/**
 * Stock Daisy themes from `index.css` that are not replaced by an audited palette
 * with the same `data-theme` / `name:` (e.g. audited `nord.css` wins over Daisy stock).
 */
const daisyThemesNotAudited = daisyStockThemeMetas.filter((t) => !auditedThemeNames.has(t.name));

/**
 * The full theme list as known *at startup*. User themes register at runtime
 * via `userThemesStore` (Phase 7) and aren't included here.
 */
export const themes: readonly ThemeMeta[] = [...builtInThemes, ...daisyThemesNotAudited];

/** Lookup by name (handy for settings UI). */
export function findTheme(name: string): ThemeMeta | undefined {
  return themes.find((t) => t.name === name);
}
