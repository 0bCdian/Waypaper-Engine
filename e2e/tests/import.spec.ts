import { test, expect } from "../fixtures";
import { resolve, join } from "node:path";
import { copyFileSync } from "node:fs";

const TEST_IMAGES_DIR = resolve(__dirname, "..", "test-data", "images");

test.describe("Import", () => {
	test("import returns processing status", async ({ api, daemon }) => {
		const paths = [1, 2, 3].map((i) => {
			const src = join(TEST_IMAGES_DIR, `test_${i}.jpg`);
			const dst = join(daemon.imagesDir, `import_${i}.jpg`);
			copyFileSync(src, dst);
			return dst;
		});

		const res = await api.post("/images", { paths });
		expect(res.status).toBe(202);
		const data = res.data as { status: string; total: number; batch_id: string };
		expect(data.status).toBe("processing");
		expect(data.total).toBe(3);
		expect(data.batch_id).toBeTruthy();
	});

	test("images appear after processing completes", async ({ api, daemon }) => {
		const paths = [1, 2].map((i) => {
			const src = join(TEST_IMAGES_DIR, `test_${i}.jpg`);
			const dst = join(daemon.imagesDir, `appear_${i}.jpg`);
			copyFileSync(src, dst);
			return dst;
		});

		await api.post("/images", { paths });
		await new Promise((r) => setTimeout(r, 3000));

		const listRes = await api.get("/images?page=1&per_page=50");
		expect(listRes.status).toBe(200);
		const data = listRes.data as { data: unknown[]; pagination: { total_items: number } };
		expect(data.pagination.total_items).toBe(2);
	});

	test("tags endpoint returns array", async ({ api }) => {
		const res = await api.get("/images/tags");
		expect(res.status).toBe(200);
		const data = res.data as { tags: string[] };
		expect(Array.isArray(data.tags)).toBe(true);
	});

	test("import with folder_id", async ({ api, daemon }) => {
		const folderRes = await api.post("/folders", { name: "Import Folder" });
		expect(folderRes.status).toBe(201);
		const folder = folderRes.data as { id: number };

		const src = join(TEST_IMAGES_DIR, "test_1.jpg");
		const dst = join(daemon.imagesDir, "folder_import.jpg");
		copyFileSync(src, dst);

		const importRes = await api.post("/images", {
			paths: [dst],
			folder_id: folder.id,
		});
		expect(importRes.status).toBe(202);
		await new Promise((r) => setTimeout(r, 2000));

		const listRes = await api.get(`/images?folder_id=${folder.id}&page=1&per_page=50`);
		expect(listRes.status).toBe(200);
		const listData = listRes.data as { data: unknown[]; pagination: { total_items: number } };
		expect(listData.pagination.total_items).toBe(1);
	});
});
