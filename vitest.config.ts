import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
	plugins: [react()],
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
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: ["./src/test/setup.ts"],
		include: ["src/**/*.test.{ts,tsx}"],
		coverage: { provider: "v8", include: ["src/**"] },
	},
});
