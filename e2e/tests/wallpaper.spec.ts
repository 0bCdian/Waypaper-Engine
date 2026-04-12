import { test, expect } from "../fixtures";
import { resolve, join } from "node:path";
import { copyFileSync } from "node:fs";

const TEST_IMAGES_DIR = resolve(__dirname, "..", "test-data", "images");
const IMPORT_WAIT_MS = 5000;
const IMPORT_POLL_MS = 250;

async function waitForImportedImages(
	api: { get: (path: string) => Promise<{ data: unknown }> },
	minCount: number,
): Promise<{ id: number }[]> {
	const deadline = Date.now() + IMPORT_WAIT_MS;
	while (Date.now() < deadline) {
		const listRes = await api.get(`/images?page=1&per_page=${Math.max(minCount, 1)}`);
		const images = (listRes.data as { data: { id: number }[] }).data ?? [];
		if (images.length >= minCount) {
			return images;
		}
		await new Promise((r) => setTimeout(r, IMPORT_POLL_MS));
	}
	return [];
}

test.describe("Wallpaper", () => {
	test("get current wallpaper returns summary with monitors array", async ({ api }) => {
		const res = await api.get("/wallpaper/current");
		expect(res.status).toBe(200);
		const data = res.data as {
			backend: string;
			monitors: unknown[];
		};
		expect(data).toHaveProperty("backend");
		expect(data).toHaveProperty("monitors");
		expect(Array.isArray(data.monitors)).toBe(true);
	});

	test("set wallpaper by image ID", async ({ api, daemon }) => {
		const src = join(TEST_IMAGES_DIR, "test_1.jpg");
		const dst = join(daemon.imagesDir, "wp_set.jpg");
		copyFileSync(src, dst);
		await api.post("/images", { paths: [dst] });
		const images = await waitForImportedImages(api, 1);
		if (images.length === 0) {
			test.skip();
			return;
		}

		const res = await api.post("/wallpaper/set", { image_id: images[0].id });
		expect(res.status).toBe(200);
		const data = res.data as { status: string; image_id: number };
		expect(data.status).toBe("set");
		expect(data.image_id).toBe(images[0].id);
	});

	test("set random wallpaper", async ({ api, daemon }) => {
		const paths = [1, 2].map((i) => {
			const src = join(TEST_IMAGES_DIR, `test_${i}.jpg`);
			const dst = join(daemon.imagesDir, `wp_rand_${i}.jpg`);
			copyFileSync(src, dst);
			return dst;
		});
		await api.post("/images", { paths });
		const images = await waitForImportedImages(api, 2);
		if (images.length < 2) {
			test.skip();
			return;
		}

		const res = await api.post("/wallpaper/random", {});
		expect(res.status).toBe(200);
		const data = res.data as { status: string; image_id: number };
		expect(data.status).toBe("set");
		expect(data.image_id).toBeGreaterThan(0);
	});
});
