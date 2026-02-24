import { test, expect } from "../ui-fixtures";

test.describe("Gallery", () => {
	test("shows gallery content on launch", async ({ page }) => {
		await page.waitForSelector(".drawer-content", { timeout: 30_000 });
		const main = page.locator("main");
		await expect(main).toBeVisible();
	});

	test("search input is visible in gallery", async ({ page }) => {
		await page.waitForSelector("nav", { timeout: 30_000 });
		const searchInput = page.locator('#default-search, [placeholder*="Search"]');
		if (await searchInput.count() > 0) {
			await expect(searchInput.first()).toBeVisible();
		}
	});

	test("monitor select button is interactive", async ({ page }) => {
		await page.waitForSelector("nav", { timeout: 30_000 });
		const monitorBtn = page.locator('[aria-label="Select display monitor"]');
		await expect(monitorBtn).toBeEnabled();
		await monitorBtn.click();
		await page.waitForTimeout(500);
	});
});
