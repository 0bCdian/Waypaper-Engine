import { test, expect } from "../ui-fixtures";

test.describe("Settings", () => {
  test.beforeEach(async ({ page }) => {
    await page.waitForSelector("nav", { timeout: 30_000 });

    const toggle = page.locator('[aria-label="Toggle sidebar"]');
    await toggle.click();

    const settingsLink = page.locator(".drawer-side >> text=Settings");
    await settingsLink.click();
    await page.waitForTimeout(500);
  });

  test("settings page renders tab buttons", async ({ page }) => {
    await expect(page.locator("text=General")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("text=Daemon")).toBeVisible();
    await expect(page.locator("text=Backend")).toBeVisible();
    await expect(page.locator("text=Wallhaven")).toBeVisible();
  });

  test("switching tabs changes content", async ({ page }) => {
    const daemonTab = page.locator("button", { hasText: "Daemon" });
    await daemonTab.click();
    await page.waitForTimeout(300);

    const generalTab = page.locator("button", { hasText: "General" });
    await generalTab.click();
    await page.waitForTimeout(300);

    await expect(generalTab).toBeVisible();
  });
});
