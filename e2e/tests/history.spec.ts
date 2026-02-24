import { test, expect } from "../fixtures";

test.describe("History", () => {
	test("history starts empty on fresh daemon", async ({ api }) => {
		const res = await api.get("/images/history");
		expect(res.status).toBe(200);
		const data = res.data as unknown[];
		expect(Array.isArray(data)).toBe(true);
		expect(data.length).toBe(0);
	});

	test("clear history returns success", async ({ api }) => {
		const res = await api.del("/images/history");
		expect(res.status).toBe(200);
		const data = res.data as { status: string };
		expect(data.status).toBe("cleared");
	});

	test("clear history makes history empty", async ({ api }) => {
		await api.del("/images/history");
		const res = await api.get("/images/history");
		expect(res.status).toBe(200);
		expect((res.data as unknown[]).length).toBe(0);
	});
});
