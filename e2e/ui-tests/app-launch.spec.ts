import { test, expect } from "../ui-fixtures";

test.describe("App Launch", () => {
  test("window is visible and has correct title", async ({ electronApp }) => {
    const window = await electronApp.firstWindow();
    const title = await window.title();
    expect(title.toLowerCase()).toContain("waypaper");
    const isVisible = await window.isVisible();
    expect(isVisible).toBe(true);
  });

  test("main content area renders", async ({ page }) => {
    await page.waitForSelector(".drawer-content", { timeout: 30_000 });
    const drawerContent = page.locator(".drawer-content");
    await expect(drawerContent).toBeVisible();
  });

  test("navbar renders with monitor button", async ({ page }) => {
    await page.waitForSelector("nav", { timeout: 30_000 });
    const monitorButton = page.locator('[aria-label="Select display monitor"]');
    await expect(monitorButton).toBeVisible();
  });
});
