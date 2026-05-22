import { test, expect } from "../fixtures";
import { resolve, join } from "node:path";
import { copyFileSync } from "node:fs";

const TEST_IMAGES_DIR = resolve(__dirname, "..", "test-data", "images");

test.describe("Gallery", () => {
  test("images list is empty on fresh daemon", async ({ api }) => {
    const res = await api.get("/images?page=1&per_page=50");
    expect(res.status).toBe(200);
    const body = res.data as {
      data: unknown[];
      pagination: { total_items: number };
    };
    expect(body.data).toEqual([]);
    expect(body.pagination.total_items).toBe(0);
  });

  test("import images and verify they appear", async ({ api, daemon }) => {
    const targetPaths = [1, 2, 3].map((i) => {
      const src = join(TEST_IMAGES_DIR, `test_${i}.jpg`);
      const dst = join(daemon.imagesDir, `test_${i}.jpg`);
      copyFileSync(src, dst);
      return dst;
    });

    const importRes = await api.post("/images", { paths: targetPaths });
    expect(importRes.status).toBe(202);
    const importData = importRes.data as { status: string; total: number };
    expect(importData.total).toBe(3);

    await new Promise((r) => setTimeout(r, 3000));

    const listRes = await api.get("/images?page=1&per_page=50");
    expect(listRes.status).toBe(200);
    const listData = listRes.data as {
      data: { id: number; name: string }[];
      pagination: { total_items: number };
    };
    expect(listData.pagination.total_items).toBe(3);
    expect(listData.data.length).toBe(3);
  });

  test("get single image by ID", async ({ api, daemon }) => {
    const src = join(TEST_IMAGES_DIR, "test_1.jpg");
    const dst = join(daemon.imagesDir, "single_test.jpg");
    copyFileSync(src, dst);

    await api.post("/images", { paths: [dst] });
    await new Promise((r) => setTimeout(r, 2000));

    const listRes = await api.get("/images?page=1&per_page=1");
    const listData = listRes.data as { data: { id: number }[] };
    const imageId = listData.data[0].id;

    const getRes = await api.get(`/images/${imageId}`);
    expect(getRes.status).toBe(200);
    const img = getRes.data as {
      id: number;
      name: string;
      width: number;
      height: number;
    };
    expect(img.id).toBe(imageId);
    expect(img.width).toBeGreaterThan(0);
    expect(img.height).toBeGreaterThan(0);
  });

  test("delete images", async ({ api, daemon }) => {
    const paths = [1, 2].map((i) => {
      const src = join(TEST_IMAGES_DIR, `test_${i}.jpg`);
      const dst = join(daemon.imagesDir, `del_${i}.jpg`);
      copyFileSync(src, dst);
      return dst;
    });

    await api.post("/images", { paths });
    await new Promise((r) => setTimeout(r, 2000));

    const listRes = await api.get("/images?page=1&per_page=50");
    const ids = (listRes.data as { data: { id: number }[] }).data.map(
      (img) => img.id,
    );
    expect(ids.length).toBeGreaterThanOrEqual(2);

    const delRes = await api.del("/images", { ids });
    expect(delRes.status).toBe(200);
    const delData = delRes.data as { deleted: number };
    expect(delData.deleted).toBe(ids.length);

    const afterRes = await api.get("/images?page=1&per_page=50");
    const afterData = afterRes.data as {
      data: unknown[];
      pagination: { total_items: number };
    };
    expect(afterData.pagination.total_items).toBe(0);
  });

  test("image count endpoint", async ({ api, daemon }) => {
    const countRes = await api.get("/images/count");
    expect(countRes.status).toBe(200);
    expect((countRes.data as { count: number }).count).toBe(0);

    const src = join(TEST_IMAGES_DIR, "test_1.jpg");
    const dst = join(daemon.imagesDir, "count_test.jpg");
    copyFileSync(src, dst);
    await api.post("/images", { paths: [dst] });
    await new Promise((r) => setTimeout(r, 2000));

    const countRes2 = await api.get("/images/count");
    expect(countRes2.status).toBe(200);
    expect((countRes2.data as { count: number }).count).toBe(1);
  });
});
