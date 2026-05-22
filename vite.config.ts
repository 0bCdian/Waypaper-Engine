import { defineConfig, type Plugin } from "vite";
import electron from "vite-plugin-electron";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";
import { daemonUnixSocketProxyPlugin } from "./scripts/vite-plugin-daemon-proxy";
import { themeRegistryPlugin } from "./scripts/vite-plugin-theme-registry";

/** During `vite serve`, allow React standalone DevTools bridge + inject its script tag. Production builds keep strict CSP without localhost scripts. */
function reactStandaloneDevtoolsPlugin(command: string): Plugin {
  return {
    name: "wp-react-devtools-csp-dev-only",
    apply: "serve",
    transformIndexHtml(html) {
      if (command !== "serve") return html;
      const localhostDevtools = "http://localhost:8097 http://127.0.0.1:8097";
      let next = html.replace(
        "; script-src-elem 'self'; script-src 'self';",
        `; script-src-elem 'self' ${localhostDevtools}; script-src 'self' ${localhostDevtools};`,
      );
      next = next.replace(
        '<div id="root"></div>',
        '<div id="root"></div>\n    <!-- React standalone DevTools listener (must run standalone: `npx react-devtools`) -->\n    <script src="http://localhost:8097"></script>',
      );
      return next;
    },
  };
}

export default defineConfig(({ command }) => ({
  base: "./",
  build: {
    minify: process.env.DEBUG_BUILD ? false : "esbuild",
    sourcemap: process.env.DEV === "true" ? "inline" : false,
  },
  resolve: {
    // Longer `find` entries must win over `@` — otherwise `@/shared/x` resolves as `src/shared/x`.
    alias: [
      {
        find: "@/components",
        replacement: resolve(__dirname, "src/components"),
      },
      { find: "@/utils", replacement: resolve(__dirname, "src/utils") },
      { find: "@/stores", replacement: resolve(__dirname, "src/stores") },
      { find: "@/shared", replacement: resolve(__dirname, "shared") },
      { find: "@/types", replacement: resolve(__dirname, "src/types") },
      { find: "@", replacement: resolve(__dirname, "src") },
    ],
  },
  plugins: [
    daemonUnixSocketProxyPlugin(),
    themeRegistryPlugin({
      themesDir: resolve(__dirname, "src/styles/themes"),
      outFile: resolve(__dirname, "src/styles/themes/_index.ts"),
    }),
    reactStandaloneDevtoolsPlugin(command),
    react({
      babel: {
        plugins: ["babel-plugin-react-compiler"],
      },
    }),
    tailwindcss(),
    electron([
      {
        entry: "electron/main.ts",
        vite: {
          build: {
            minify: false,
            sourcemap: true,
            rollupOptions: {
              external: [
                "pino",
                "pino-roll",
                "pino-pretty",
                "thread-stream",
                "pino-abstract-transport",
              ],
            },
          },
          define: {
            "process.env.DEV": JSON.stringify(process.env.DEV || "false"),
          },
        },
      },
      {
        entry: "electron/preload.ts",
        onstart(options) {
          options.reload();
        },
      },
    ]),
  ],
  define: {
    global: "globalThis",
  },
}));
