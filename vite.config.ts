import { defineConfig } from "vite";
import electron from "vite-plugin-electron";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

export default defineConfig({
	base: "./",
	build: {
		minify: process.env.DEBUG_BUILD ? false : "esbuild",
		sourcemap: process.env.DEV === "true" ? "inline" : false,
	},
	resolve: {
		// Longer `find` entries must win over `@` — otherwise `@/shared/x` resolves as `src/shared/x`.
		alias: [
			{ find: "@/components", replacement: resolve(__dirname, "src/components") },
			{ find: "@/utils", replacement: resolve(__dirname, "src/utils") },
			{ find: "@/stores", replacement: resolve(__dirname, "src/stores") },
			{ find: "@/shared", replacement: resolve(__dirname, "shared") },
			{ find: "@/types", replacement: resolve(__dirname, "src/types") },
			{ find: "@", replacement: resolve(__dirname, "src") },
		],
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
});
