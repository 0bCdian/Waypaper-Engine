export type {
  BuiltinThemeMeta,
  ThemeCategory,
  ThemeMeta,
  ThemeSource,
  UserThemeMeta,
} from "../styles/themes/types";

/* ── Design System types ───────────────────────────────────────── */

/** Available design system modes */
export type DesignMode = "default" | "neobrutalist";

/**
 * Neobrutalist design system configuration.
 * Controls the visual parameters of the neobrutalist overlay.
 */
export interface NeoConfig {
  /** Horizontal hard-shadow offset in pixels (1-6). */
  shadowOffsetX: number;
  /** Vertical hard-shadow offset in pixels (1-6). */
  shadowOffsetY: number;
  /** Border width in pixels (1-4). */
  borderWidth: number;
  /** Corner radius in rem (0-1). */
  cornerRadius: number;
  /** Render image cards as polaroid-style frames. */
  polaroidCards: boolean;
}

/**
 * Full design system configuration stored by the app.
 */
export interface DesignSystemConfig {
  /** Currently active design mode. */
  designMode: DesignMode;
  /** Neobrutalist-specific parameters. */
  neoConfig: NeoConfig;
}
