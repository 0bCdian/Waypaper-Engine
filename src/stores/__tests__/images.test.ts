import { vi, describe, it, expect, beforeEach } from "vitest";
import { act } from "@testing-library/react";
import { createMockAPI } from "../../test/mocks/apiRenderer";
import { sampleRendererImage } from "../../test/mocks/fixtures";
import type { rendererImage } from "../../types/rendererTypes";

describe("useImagesStore", () => {
  let mockAPI: ReturnType<typeof createMockAPI>;

  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    mockAPI = createMockAPI();
    Object.defineProperty(window, "API_RENDERER", {
      value: mockAPI,
      writable: true,
      configurable: true,
    });
  });

  async function getStore() {
    const mod = await import("../images");
    return mod.useImagesStore;
  }

  function seed(store: Awaited<ReturnType<typeof getStore>>, images: rendererImage[]) {
    store.setState({
      imagesArray: images,
      imagesMap: new Map(images.map((image) => [image.id, image])),
      isEmpty: images.length === 0,
    });
  }

  it("setFilters updates filters state", async () => {
    const useImagesStore = await getStore();
    const newFilters = {
      ...useImagesStore.getState().filters,
      order: "asc" as const,
      filterTokens: ["q:test"],
    };

    act(() => {
      useImagesStore.getState().setFilters(newFilters);
    });

    expect(useImagesStore.getState().filters.order).toBe("asc");
    expect(useImagesStore.getState().filters.filterTokens).toContain("q:test");
  });

  it("reQueryImages calls getImages and updates state", async () => {
    const imgs = [sampleRendererImage(1), sampleRendererImage(2)];
    mockAPI.goDaemon.getImages = vi.fn().mockResolvedValue({
      data: imgs,
      pagination: { page: 1, per_page: 50, total_items: 2, total_pages: 1 },
    });

    const useImagesStore = await getStore();

    await act(async () => {
      useImagesStore.getState().reQueryImages();
      await vi.waitFor(() => {
        expect(useImagesStore.getState().isQueried).toBe(true);
      });
    });

    const state = useImagesStore.getState();
    expect(mockAPI.goDaemon.getImages).toHaveBeenCalled();
    expect(state.imagesArray).toHaveLength(2);
    expect(state.imagesMap.size).toBe(2);
    expect(state.isEmpty).toBe(false);
  });

  it("reQueryImages handles API error gracefully", async () => {
    mockAPI.goDaemon.getImages = vi.fn().mockRejectedValue(new Error("Network error"));

    const useImagesStore = await getStore();

    await act(async () => {
      useImagesStore.getState().reQueryImages();
      await vi.waitFor(() => {
        expect(useImagesStore.getState().isQueried).toBe(true);
      });
    });

    const state = useImagesStore.getState();
    expect(state.imagesArray).toHaveLength(0);
    expect(state.isEmpty).toBe(true);
  });

  it("reQueryImages preserves active filters in daemon query", async () => {
    mockAPI.goDaemon.getImages = vi.fn().mockResolvedValue({
      data: [],
      pagination: { page: 1, per_page: 50, total_items: 0, total_pages: 1 },
    });

    const useImagesStore = await getStore();

    act(() => {
      useImagesStore.getState().setFilters({
        ...useImagesStore.getState().filters,
        order: "asc",
        type: "name",
        mediaType: "web",
        filterTokens: ["q:neon city", "tag:night", "tag:favorites", "color:#112233"],
      });
    });

    await act(async () => {
      useImagesStore.getState().reQueryImages();
      await vi.waitFor(() => {
        expect(mockAPI.goDaemon.getImages).toHaveBeenCalled();
      });
    });

    expect(mockAPI.goDaemon.getImages).toHaveBeenCalledWith(
      expect.objectContaining({
        sort_by: "name",
        sort_order: "asc",
        media_type: "web",
        search: "neon city",
        tags: expect.stringMatching(/^(favorites,night|night,favorites)$/),
        colors: "#112233",
      }),
    );
  });

  it("addToSelectedImages and removeFromSelectedImages", async () => {
    const useImagesStore = await getStore();
    const img = sampleRendererImage(5);

    act(() => {
      seed(useImagesStore, [img]);
    });
    act(() => {
      useImagesStore.getState().addToSelectedImages(img);
    });

    expect(useImagesStore.getState().selectedImages.has(5)).toBe(true);

    act(() => {
      useImagesStore.getState().removeFromSelectedImages(img);
    });

    expect(useImagesStore.getState().selectedImages.has(5)).toBe(false);
  });

  it("selectAllImagesInCurrentPage selects all images", async () => {
    const useImagesStore = await getStore();
    const imgs = [sampleRendererImage(1), sampleRendererImage(2), sampleRendererImage(3)];

    act(() => {
      seed(useImagesStore, imgs);
    });
    act(() => {
      useImagesStore.getState().selectAllImagesInCurrentPage();
    });

    const selected = useImagesStore.getState().selectedImages;
    expect(selected.size).toBe(3);
    expect(selected.has(1)).toBe(true);
    expect(selected.has(2)).toBe(true);
    expect(selected.has(3)).toBe(true);
  });

  it("clearSelection empties selected set", async () => {
    const useImagesStore = await getStore();
    const img = sampleRendererImage(1);

    act(() => {
      seed(useImagesStore, [img]);
      useImagesStore.getState().addToSelectedImages(img);
    });

    expect(useImagesStore.getState().selectedImages.size).toBe(1);

    act(() => {
      useImagesStore.getState().clearSelection();
    });

    expect(useImagesStore.getState().selectedImages.size).toBe(0);
  });

  it("clearSelectionOnCurrentPage removes only ids on imagesArray", async () => {
    const useImagesStore = await getStore();
    const onPage = [sampleRendererImage(1), sampleRendererImage(2)];

    act(() => {
      seed(useImagesStore, onPage);
      useImagesStore.getState().setSelectedImages(new Set([1, 2, 99]));
    });

    act(() => {
      useImagesStore.getState().clearSelectionOnCurrentPage();
    });

    const sel = useImagesStore.getState().selectedImages;
    expect(sel.has(1)).toBe(false);
    expect(sel.has(2)).toBe(false);
    expect(sel.has(99)).toBe(true);
    expect(sel.size).toBe(1);
  });

  it("renameImage calls API and updates map", async () => {
    const renamed: rendererImage = {
      ...sampleRendererImage(1),
      name: "new_name.jpg",
    };
    mockAPI.goDaemon.updateImage = vi.fn().mockResolvedValue(renamed);

    const useImagesStore = await getStore();

    act(() => {
      seed(useImagesStore, [sampleRendererImage(1)]);
    });

    await act(async () => {
      await useImagesStore.getState().renameImage(1, "new_name.jpg");
    });

    expect(mockAPI.goDaemon.updateImage).toHaveBeenCalledWith(1, {
      name: "new_name.jpg",
    });
    const updated = useImagesStore.getState().imagesMap.get(1);
    expect(updated?.name).toBe("new_name.jpg");
  });

  it("renameImage keeps off-page cached images out of the grid", async () => {
    mockAPI.goDaemon.updateImage = vi
      .fn()
      .mockResolvedValue({ ...sampleRendererImage(1), name: "renamed.jpg" });
    const useImagesStore = await getStore();
    const offPage = sampleRendererImage(99);
    seed(useImagesStore, [sampleRendererImage(1)]);
    useImagesStore.setState((s) => ({ imagesMap: new Map(s.imagesMap).set(99, offPage) }));

    await act(async () => {
      await useImagesStore.getState().renameImage(1, "renamed.jpg");
    });

    expect(useImagesStore.getState().imagesArray.map((image) => image.id)).toEqual([1]);
  });
});
