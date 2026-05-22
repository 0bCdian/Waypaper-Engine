import type { BuiltinThemeMeta } from "../styles/themes/types";

/**
 * Stock DaisyUI theme names from `src/index.css` → `@plugin "daisyui" { themes: ... }`.
 * Keep in sync with that block.
 */
const DAISY_STOCK_THEME_NAMES = [
  "light",
  "dark",
  "cupcake",
  "bumblebee",
  "emerald",
  "synthwave",
  "retro",
  "halloween",
  "forest",
  "lofi",
  "pastel",
  "wireframe",
  "black",
  "dracula",
  "cmyk",
  "autumn",
  "business",
  "acid",
  "lemonade",
  "night",
  "dim",
  "nord",
] as const;

type DaisyStockName = (typeof DAISY_STOCK_THEME_NAMES)[number];

const DISPLAY: Record<DaisyStockName, string> = {
  light: "Light",
  dark: "Dark",
  cupcake: "Cupcake",
  bumblebee: "Bumblebee",
  emerald: "Emerald",
  synthwave: "Synthwave",
  retro: "Retro",
  halloween: "Halloween",
  forest: "Forest",
  lofi: "Lo-fi",
  pastel: "Pastel",
  wireframe: "Wireframe",
  black: "Black",
  dracula: "Dracula",
  cmyk: "CMYK",
  autumn: "Autumn",
  business: "Business",
  acid: "Acid",
  lemonade: "Lemonade",
  night: "Night",
  dim: "Dim",
  nord: "Nord",
};

/** Light vs dark bucket for settings filters (matches Daisy stock themes broadly). */
const CATEGORY: Record<DaisyStockName, "light" | "dark"> = {
  light: "light",
  dark: "dark",
  cupcake: "light",
  bumblebee: "light",
  emerald: "light",
  synthwave: "dark",
  retro: "light",
  halloween: "dark",
  forest: "dark",
  lofi: "light",
  pastel: "light",
  wireframe: "light",
  black: "dark",
  dracula: "dark",
  cmyk: "light",
  autumn: "light",
  business: "light",
  acid: "dark",
  lemonade: "light",
  night: "dark",
  dim: "dark",
  nord: "dark",
};

const DAISY_THEMES_DOC = "https://daisyui.com/docs/themes";

export const daisyStockThemeMetas: readonly BuiltinThemeMeta[] = DAISY_STOCK_THEME_NAMES.map(
  (name) => ({
    name,
    displayName: DISPLAY[name],
    category: CATEGORY[name],
    source: "builtin" as const,
    sourceUrl: DAISY_THEMES_DOC,
  }),
);
