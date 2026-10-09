import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import { parseHeader } from "../../scripts/vite-plugin-theme-registry";

const CSS_ID = "virtual:wp-palettes.css";
const LIST_ID = "virtual:wp-palettes";

/** Serves the app's built-in palettes (src/styles/themes/*.css) to the docs. */
export function palettesPlugin(themesDir: string): Plugin {
  function load() {
    const list: { name: string; displayName: string; category: string }[] = [];
    const blocks: string[] = [];
    for (const file of readdirSync(themesDir).sort()) {
      if (!file.endsWith(".css") || file.startsWith("_")) continue;
      const css = readFileSync(path.join(themesDir, file), "utf8");
      const meta = parseHeader(css);
      if (!meta) continue;
      const body = css.match(/@plugin\s+"daisyui\/theme"\s*\{([\s\S]*?)\}/)?.[1] ?? "";
      const colors = [...body.matchAll(/(--color-[\w-]+):\s*([^;]+);/g)].map(
        (m) => `  ${m[1]}: ${m[2].trim()};`,
      );
      const scheme = body.match(/color-scheme:\s*(dark|light)/)?.[1] ?? meta.category;
      blocks.push(
        `[data-theme="${meta.name}"] {\n${colors.join("\n")}\n  color-scheme: ${scheme};\n}`,
      );
      list.push({ name: meta.name, displayName: meta.displayName, category: scheme });
    }
    return { css: blocks.join("\n"), list };
  }

  return {
    name: "waypaper:docs-palettes",
    resolveId(id) {
      if (id === CSS_ID || id === LIST_ID) return "\0" + id;
    },
    load(id) {
      if (id === "\0" + CSS_ID) return load().css;
      if (id === "\0" + LIST_ID) return `export default ${JSON.stringify(load().list)};`;
    },
  };
}
