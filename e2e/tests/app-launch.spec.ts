import { test, expect } from "../fixtures";

test.describe("Daemon Health", () => {
	test("healthz returns ok", async ({ api }) => {
		const res = await api.get("/healthz");
		expect(res.status).toBe(200);
		expect(res.data).toEqual({ status: "ok" });
	});

	test("info returns daemon metadata", async ({ api }) => {
		const res = await api.get("/info");
		expect(res.status).toBe(200);
		const info = res.data as Record<string, unknown>;
		expect(info.version).toBeDefined();
		expect(info.pid).toBeGreaterThan(0);
		expect(info.os).toBeDefined();
		expect(info.arch).toBeDefined();
	});

	test("monitors endpoint returns array", async ({ api }) => {
		const res = await api.get("/monitors");
		expect(res.status).toBe(200);
		expect(Array.isArray(res.data)).toBe(true);
	});
});
