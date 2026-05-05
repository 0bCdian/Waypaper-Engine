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
