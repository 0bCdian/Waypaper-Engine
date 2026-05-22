import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  retries: 1,
  workers: 1,
  use: {
    trace: "on-first-retry",
  },
  reporter: [["list"], ["html", { outputFolder: "playwright-report" }]],
});
