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
