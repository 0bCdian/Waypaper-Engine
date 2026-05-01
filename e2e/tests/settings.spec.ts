import { test, expect } from "../fixtures";

test.describe("Settings", () => {
  test("read full config", async ({ api }) => {
    const res = await api.get("/config");
    expect(res.status).toBe(200);
    const config = res.data as Record<string, unknown>;
    expect(config.app).toBeDefined();
    expect(config.daemon).toBeDefined();
    expect(config.backend).toBeDefined();
    expect(config.monitors).toBeDefined();
  });

  test("read config section", async ({ api }) => {
    const res = await api.get("/config/app");
    expect(res.status).toBe(200);
    const app = res.data as Record<string, unknown>;
    expect(app.images_per_page).toBe(50);
    expect(app.theme).toBe("kolision-raw");
  });

  test("patch app config section", async ({ api }) => {
    const patchRes = await api.patch("/config/app", {
      notifications: false,
      images_per_page: 25,
    });
    expect(patchRes.status).toBe(200);

    const readRes = await api.get("/config/app");
    expect(readRes.status).toBe(200);
    const app = readRes.data as Record<string, unknown>;
    expect(app.notifications).toBe(false);
    expect(app.images_per_page).toBe(25);
  });

  test("config persists across reads", async ({ api }) => {
    await api.patch("/config/app", { images_per_page: 100 });

    const res1 = await api.get("/config/app");
    expect((res1.data as Record<string, unknown>).images_per_page).toBe(100);

    const res2 = await api.get("/config/app");
    expect((res2.data as Record<string, unknown>).images_per_page).toBe(100);
  });
});
