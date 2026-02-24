import { test, expect } from "../fixtures";
import { resolve, join } from "node:path";
import { copyFileSync } from "node:fs";

const TEST_IMAGES_DIR = resolve(__dirname, "..", "test-data", "images");

test.describe("Playlist", () => {
	test("create a playlist", async ({ api }) => {
		const res = await api.post("/playlists", {
			name: "E2E Test Playlist",
			configuration: {
				type: "timer",
				interval: 60,
				order: "ordered",
				show_animations: false,
				always_start_on_first_image: true,
			},
			images: [],
		});
		expect(res.status).toBe(201);
		const playlist = res.data as { id: number; name: string };
		expect(playlist.name).toBe("E2E Test Playlist");
		expect(playlist.id).toBeGreaterThan(0);
	});

	test("create playlist with images", async ({ api, daemon }) => {
		const paths = [1, 2, 3].map((i) => {
			const src = join(TEST_IMAGES_DIR, `test_${i}.jpg`);
			const dst = join(daemon.imagesDir, `pl_${i}.jpg`);
			copyFileSync(src, dst);
			return dst;
		});
		await api.post("/images", { paths });
		await new Promise((r) => setTimeout(r, 3000));

		const listRes = await api.get("/images?page=1&per_page=50");
		const images = (listRes.data as { data: { id: number }[] }).data;
		const imageEntries = images.map((img) => ({ image_id: img.id }));

		const res = await api.post("/playlists", {
			name: "With Images",
			configuration: {
				type: "timer",
				interval: 60,
				order: "ordered",
				show_animations: false,
				always_start_on_first_image: true,
			},
			images: imageEntries,
		});
		expect(res.status).toBe(201);
		const pl = res.data as { images: unknown[] };
		expect(pl.images.length).toBe(images.length);
	});

	test("list playlists", async ({ api }) => {
		await api.post("/playlists", {
			name: "List Test",
			configuration: { type: "timer", interval: 60, order: "ordered", show_animations: false, always_start_on_first_image: true },
			images: [],
		});

		const res = await api.get("/playlists");
		expect(res.status).toBe(200);
		const playlists = res.data as { id: number }[];
		expect(playlists.length).toBeGreaterThanOrEqual(1);
	});

	test("get single playlist", async ({ api }) => {
		const createRes = await api.post("/playlists", {
			name: "Get Test",
			configuration: { type: "timer", interval: 120, order: "random", show_animations: true, always_start_on_first_image: false },
			images: [],
		});
		const created = createRes.data as { id: number };

		const res = await api.get(`/playlists/${created.id}`);
		expect(res.status).toBe(200);
		const pl = res.data as { id: number; name: string; configuration: { interval: number } };
		expect(pl.name).toBe("Get Test");
		expect(pl.configuration.interval).toBe(120);
	});

	test("update playlist", async ({ api }) => {
		const createRes = await api.post("/playlists", {
			name: "Update Me",
			configuration: { type: "timer", interval: 60, order: "ordered", show_animations: false, always_start_on_first_image: true },
			images: [],
		});
		const created = createRes.data as { id: number };

		const updateRes = await api.patch(`/playlists/${created.id}`, {
			name: "Updated Name",
		});
		expect(updateRes.status).toBe(200);
		const updated = updateRes.data as { name: string };
		expect(updated.name).toBe("Updated Name");
	});

	test("delete playlist", async ({ api }) => {
		const createRes = await api.post("/playlists", {
			name: "Delete Me",
			configuration: { type: "timer", interval: 60, order: "ordered", show_animations: false, always_start_on_first_image: true },
			images: [],
		});
		const created = createRes.data as { id: number };

		const delRes = await api.del(`/playlists/${created.id}`);
		expect(delRes.status).toBe(200);
		expect((delRes.data as { status: string }).status).toBe("deleted");

		const getRes = await api.get(`/playlists/${created.id}`);
		expect(getRes.status).toBe(404);
	});
});
