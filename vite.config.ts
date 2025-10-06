import { defineConfig } from "vite";
import electron from "vite-plugin-electron";
import renderer from "vite-plugin-electron-renderer";
import react from "@vitejs/plugin-react";
// CommonJS plugin no longer needed
// https://vitejs.dev/config/
export default defineConfig({
    build: {
        minify: false,
        sourcemap: "inline"
    },
    plugins: [
        react(),
        electron([
            {
                // Main-Process entry file of the Electron App.
                entry: "electron/main.ts",
                vite: {
                    build: {
                        minify: false,
                        sourcemap: true
                    },
                    define: {
                        'process.env.DEV': JSON.stringify(process.env.DEV || 'false')
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
    define: {
        global: 'globalThis',
    },
    // optimizeDeps no longer needed without commonjs plugin
});
