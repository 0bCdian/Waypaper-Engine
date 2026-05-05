import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
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
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: [
      "src/**/*.test.{ts,tsx}",
      "electron/**/*.test.ts",
      "shared/**/*.test.ts",
      "scripts/**/*.test.ts",
    ],
    coverage: { provider: "v8", include: ["src/**"] },
  },
});
