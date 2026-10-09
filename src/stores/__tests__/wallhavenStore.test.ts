import { vi, describe, it, expect, beforeEach } from "vitest";
import type { WallhavenWallpaper } from "../wallhavenStore";

const importImages = vi.fn();
vi.mock("@/client", () => ({
  daemonClient: { importImages: (...a: unknown[]) => importImages(...a), on: vi.fn() },
}));

const wp = (id: string) =>
  ({ id, path: `/p/${id}`, tags: [], colors: [] }) as unknown as WallhavenWallpaper;

describe("wallhavenStore downloads", () => {
  beforeEach(() => {
    vi.resetModules();
    importImages.mockReset();
    Object.defineProperty(window, "API_RENDERER", {
      value: {
        wallhaven: {
          download: vi.fn().mockResolvedValue("/tmp/x"),
          detail: vi.fn().mockResolvedValue(null),
        },
      },
      writable: true,
      configurable: true,
    });
  });

  async function stores() {
    const { useWallhavenStore } = await import("../wallhavenStore");
    const { useToastStore } = await import("../toastStore");
    useToastStore.setState({ toasts: [] });
    return { w: useWallhavenStore, t: useToastStore };
  }

  it("toasts an error when a download fails", async () => {
    importImages.mockRejectedValue(new Error("boom"));
    const { w, t } = await stores();
    expect(await w.getState().downloadToGallery(wp("a"))).toBeNull();
    expect(t.getState().toasts.map((x) => x.type)).toEqual(["error"]);
  });

  it("does not toast when already downloading", async () => {
    const { w, t } = await stores();
    w.setState({ downloadingIds: new Set(["a"]) });
    expect(await w.getState().downloadToGallery(wp("a"))).toBeNull();
    expect(t.getState().toasts).toHaveLength(0);
  });

  it("downloadSelected shows one summary toast, no per-item toasts", async () => {
    importImages.mockResolvedValue({});
    const { w, t } = await stores();
    w.setState({
      results: [wp("a"), wp("b")],
      selectedWallpapers: new Set(["a", "b"]),
      scrollMode: "paginated",
    });
    await w.getState().downloadSelected();
    const toasts = t.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe("Downloaded 0 of 2 wallpapers; 2 failed");
  });
});
