import { defineConfig } from "vite";
import electron from "vite-plugin-electron";
import renderer from "vite-plugin-electron-renderer";
import react from "@vitejs/plugin-react";
import { viteCommonjs, esbuildCommonjs } from "@originjs/vite-plugin-commonjs";
// https://vitejs.dev/config/
export default defineConfig({
    build: {
        minify: false,
        sourcemap: "inline"
    },
    plugins: [
        react(),
        viteCommonjs(),
        electron([
            {
                // Main-Process entry file of the Electron App.
                entry: "electron/main.ts",
                vite: {
                    build: {
                        minify: false,
                        sourcemap: true
                    }
                }
            },
            {
                entry: "electron/preload.ts",
                onstart(options) {
                    // Notify the Renderer-Process to reload the page when the Preload-Scripts build is complete,
                    // instead of restarting the entire Electron App.
                    options.reload();
                }
            }
        ]),
        renderer()
    ],
    optimizeDeps: {
        esbuildOptions: {
            plugins: [
                // Solves:
                // https://github.com/vitejs/vite/issues/5308
                // add the name of your package
                esbuildCommonjs(["sharp", "better-sqlite3", "pino"])
            ]
        }
    }
});
