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

  it("addImage adds to array and map", async () => {
    const useImagesStore = await getStore();
    const img = sampleRendererImage(1);

    act(() => {
      useImagesStore.getState().addImage(img);
    });

    const state = useImagesStore.getState();
    expect(state.imagesArray).toHaveLength(1);
    expect(state.imagesArray[0].id).toBe(1);
    expect(state.imagesMap.get(1)).toEqual(img);
    expect(state.isEmpty).toBe(false);
  });

  it("addImages prepends in desc order", async () => {
    const useImagesStore = await getStore();
    const existing = sampleRendererImage(10);
    const newImgs = [sampleRendererImage(20), sampleRendererImage(21)];

    act(() => {
      useImagesStore.getState().addImage(existing);
    });
    act(() => {
      useImagesStore.getState().addImages(newImgs);
    });

    const state = useImagesStore.getState();
    expect(state.imagesArray).toHaveLength(3);
    expect(state.imagesArray[0].id).toBe(20);
    expect(state.imagesArray[1].id).toBe(21);
    expect(state.imagesArray[2].id).toBe(10);
  });

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
      useImagesStore.getState().addImage(img);
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
      useImagesStore.getState().addImages(imgs);
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
      useImagesStore.getState().addImage(img);
      useImagesStore.getState().addToSelectedImages(img);
    });

    expect(useImagesStore.getState().selectedImages.size).toBe(1);

    act(() => {
      useImagesStore.getState().clearSelection();
    });

    expect(useImagesStore.getState().selectedImages.size).toBe(0);
  });

  it("deleteSelectedImages calls API and removes images", async () => {
    mockAPI.goDaemon.deleteImages = vi.fn().mockResolvedValue({ deleted: 2 });

    const useImagesStore = await getStore();
    const img1 = sampleRendererImage(1);
    const img2 = sampleRendererImage(2);

    act(() => {
      useImagesStore.getState().addImages([img1, img2]);
      useImagesStore.getState().addToSelectedImages(img1);
      useImagesStore.getState().addToSelectedImages(img2);
    });

    await act(async () => {
      useImagesStore.getState().deleteSelectedImages();
      await vi.waitFor(() => {
        expect(useImagesStore.getState().imagesArray).toHaveLength(0);
      });
    });

    expect(mockAPI.goDaemon.deleteImages).toHaveBeenCalledWith([1, 2]);
    expect(useImagesStore.getState().selectedImages.size).toBe(0);
  });

  it("renameImage calls API and updates map", async () => {
    const renamed: rendererImage = {
      ...sampleRendererImage(1),
      name: "new_name.jpg",
    };
    mockAPI.goDaemon.renameImage = vi.fn().mockResolvedValue(renamed);

    const useImagesStore = await getStore();

    act(() => {
      useImagesStore.getState().addImage(sampleRendererImage(1));
    });

    await act(async () => {
      await useImagesStore.getState().renameImage(1, "new_name.jpg");
    });

    expect(mockAPI.goDaemon.renameImage).toHaveBeenCalledWith(1, "new_name.jpg");
    const updated = useImagesStore.getState().imagesMap.get(1);
    expect(updated?.name).toBe("new_name.jpg");
  });

  it("removeImagesFromStore removes images from array, map, and selection", async () => {
    const useImagesStore = await getStore();
    const imgs = [sampleRendererImage(1), sampleRendererImage(2), sampleRendererImage(3)];

    act(() => {
      useImagesStore.getState().addImages(imgs);
      useImagesStore.getState().addToSelectedImages(imgs[0]);
    });

    act(() => {
      useImagesStore.getState().removeImagesFromStore([imgs[0], imgs[1]]);
    });

    const state = useImagesStore.getState();
    expect(state.imagesArray).toHaveLength(1);
    expect(state.imagesArray[0].id).toBe(3);
    expect(state.imagesMap.has(1)).toBe(false);
    expect(state.imagesMap.has(2)).toBe(false);
    expect(state.selectedImages.has(1)).toBe(false);
  });
});
