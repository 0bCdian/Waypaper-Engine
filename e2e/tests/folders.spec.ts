import { test, expect } from "../fixtures";

test.describe("Folders", () => {
  test("folders list starts empty", async ({ api }) => {
    const res = await api.get("/folders");
    expect(res.status).toBe(200);
    const data = res.data as { data: unknown[] };
    expect(data.data).toEqual([]);
  });

  test("create folder", async ({ api }) => {
    const res = await api.post("/folders", { name: "Test Folder" });
    expect(res.status).toBe(201);
    const folder = res.data as {
      id: number;
      name: string;
      parent_id: number | null;
    };
    expect(folder.name).toBe("Test Folder");
    expect(folder.id).toBeGreaterThan(0);
    expect(folder.parent_id).toBeNull();
  });

  test("create nested folder", async ({ api }) => {
    const parentRes = await api.post("/folders", { name: "Parent" });
    const parent = parentRes.data as { id: number };

    const childRes = await api.post("/folders", {
      name: "Child",
      parent_id: parent.id,
    });
    expect(childRes.status).toBe(201);
    const child = childRes.data as { id: number; parent_id: number };
    expect(child.parent_id).toBe(parent.id);
  });

  test("get folder by ID", async ({ api }) => {
    const createRes = await api.post("/folders", { name: "Get Me" });
    const created = createRes.data as { id: number };

    const res = await api.get(`/folders/${created.id}`);
    expect(res.status).toBe(200);
    const folder = res.data as { id: number; name: string };
    expect(folder.name).toBe("Get Me");
  });

  test("get folder path (breadcrumbs)", async ({ api }) => {
    const parentRes = await api.post("/folders", { name: "Level1" });
    const parent = parentRes.data as { id: number };

    const childRes = await api.post("/folders", {
      name: "Level2",
      parent_id: parent.id,
    });
    const child = childRes.data as { id: number };

    const pathRes = await api.get(`/folders/${child.id}/path`);
    expect(pathRes.status).toBe(200);
    const pathData = pathRes.data as { data: { id: number; name: string }[] };
    expect(pathData.data.length).toBe(2);
    expect(pathData.data[0].name).toBe("Level1");
    expect(pathData.data[1].name).toBe("Level2");
  });

  test("delete folder", async ({ api }) => {
    const createRes = await api.post("/folders", { name: "Delete Me" });
    const created = createRes.data as { id: number };

    const delRes = await api.del(`/folders/${created.id}?mode=keep_contents`);
    expect(delRes.status).toBe(200);

    const getRes = await api.get(`/folders/${created.id}`);
    expect(getRes.status).toBe(404);
  });

  test("rename folder", async ({ api }) => {
    const createRes = await api.post("/folders", { name: "Old Name" });
    const created = createRes.data as { id: number };

    const updateRes = await api.patch(`/folders/${created.id}`, {
      name: "New Name",
    });
    expect(updateRes.status).toBe(200);
    const updated = updateRes.data as { name: string };
    expect(updated.name).toBe("New Name");
  });
});
