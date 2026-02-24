import { test, expect } from "../ui-fixtures";

test.describe("Navigation", () => {
	test("sidebar opens via hamburger and shows routes", async ({ page }) => {
		await page.waitForSelector("nav", { timeout: 30_000 });

		const toggle = page.locator('[aria-label="Toggle sidebar"]');
		await toggle.click();

		await page.waitForSelector(".drawer-side >> text=Gallery", { timeout: 5_000 });
		await expect(page.locator(".drawer-side >> text=Settings")).toBeVisible();
		await expect(page.locator(".drawer-side >> text=History")).toBeVisible();
		await expect(page.locator(".drawer-side >> text=Wallhaven")).toBeVisible();
	});

	test("navigating to settings renders settings page", async ({ page }) => {
		await page.waitForSelector("nav", { timeout: 30_000 });

		const toggle = page.locator('[aria-label="Toggle sidebar"]');
		await toggle.click();

		const settingsLink = page.locator(".drawer-side >> text=Settings");
		await settingsLink.click();

		await page.waitForTimeout(500);
		await expect(page.locator("text=General")).toBeVisible({ timeout: 10_000 });
	});
});
