import { defineConfig } from "vite";
import electron from "vite-plugin-electron";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

// CommonJS plugin no longer needed
// https://vitejs.dev/config/
export default defineConfig({
	base: "./",
	build: {
		minify: process.env.DEBUG_BUILD ? false : "esbuild",
		sourcemap: process.env.DEV === "true" ? "inline" : false,
	},
	resolve: {
		alias: {
			"@": resolve(__dirname, "src"),
			"@/components": resolve(__dirname, "src/components"),
			"@/utils": resolve(__dirname, "src/utils"),
			"@/stores": resolve(__dirname, "src/stores"),
			"@/shared": resolve(__dirname, "shared"),
			"@/types": resolve(__dirname, "src/types"),
		},
	},
	plugins: [
		react({
			babel: {
				plugins: ["babel-plugin-react-compiler"],
			},
		}),
		tailwindcss(),
		electron([
			{
				// Main-Process entry file of the Electron App.
				entry: "electron/main.ts",
				vite: {
					build: {
						minify: false,
						sourcemap: true,
					},
					define: {
						"process.env.DEV": JSON.stringify(process.env.DEV || "false"),
					},
				},
			},
			{
				entry: "electron/preload.ts",
				onstart(options) {
					// Notify the Renderer-Process to reload the page when the Preload-Scripts build is complete,
					// instead of restarting the entire Electron App.
					options.reload();
				},
			},
		]),
	],
	define: {
		global: "globalThis",
	},
	// optimizeDeps no longer needed without commonjs plugin
});
