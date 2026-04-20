/**
 * Canonical CSS font-family stacks for typography presets.
 * Kolision faces are loaded via Fontsource in index.css; Google Sans ditto.
 */

export const BUNDLED_FONT_BODY =
  '"Inter Variable", "Inter", ui-sans-serif, system-ui, sans-serif';

export const BUNDLED_FONT_DISPLAY =
  '"Space Grotesk Variable", "Space Grotesk", ui-sans-serif, system-ui, sans-serif';

export const BUNDLED_FONT_MONO = '"JetBrains Mono", ui-monospace, monospace';

export const GOOGLE_SANS_FONT_UI =
  '"Google Sans Flex", "Google Sans", ui-sans-serif, system-ui, sans-serif';

/** Same JetBrains bundle as Kolision for code readability */
export const GOOGLE_SANS_FONT_MONO = BUNDLED_FONT_MONO;

export const SYSTEM_FONT_BODY = "system-ui, ui-sans-serif, sans-serif";

export const SYSTEM_FONT_DISPLAY = SYSTEM_FONT_BODY;

export const SYSTEM_FONT_MONO =
  'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';
