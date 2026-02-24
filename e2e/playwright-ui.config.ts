import { defineConfig } from "@playwright/test";

export default defineConfig({
	testDir: "./ui-tests",
	timeout: 90_000,
	retries: 1,
	workers: 1,
	reporter: [["list"], ["html", { outputFolder: "playwright-ui-report" }]],
});
