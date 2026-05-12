import { beforeEach, describe, expect, it, vi } from "vitest";

describe("userThemesStore", () => {
  beforeEach(async () => {
    // Reset store between tests by re-importing fresh module
    vi.resetModules();
  });

  it("starts empty", async () => {
    const { useUserThemesStore } = await import("../userThemesStore");
    expect(useUserThemesStore.getState().themes).toEqual([]);
  });

  it("loadFromDaemon populates the store", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) => (name.toLowerCase() === "content-type" ? "application/json" : null),
      },
      json: async () => [
        { name: "neon", displayName: "Neon", source: "user", url: "/api/themes/neon.css" },
      ],
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { useUserThemesStore } = await import("../userThemesStore");
    await useUserThemesStore.getState().loadFromDaemon();
    expect(useUserThemesStore.getState().themes.length).toBe(1);
    expect(useUserThemesStore.getState().themes[0].name).toBe("neon");
  });

  it("loadFromDaemon is a no-op on fetch error", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network"));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { useUserThemesStore } = await import("../userThemesStore");
    // Should not throw
    await expect(useUserThemesStore.getState().loadFromDaemon()).resolves.toBeUndefined();
    expect(useUserThemesStore.getState().themes).toEqual([]);
  });

  it("loadFromDaemon is a no-op on non-ok response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { useUserThemesStore } = await import("../userThemesStore");
    await useUserThemesStore.getState().loadFromDaemon();
    expect(useUserThemesStore.getState().themes).toEqual([]);
  });

  it("loadFromDaemon ignores non-JSON bodies (e.g. HTML fallback)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => "text/html" },
      json: async () => {
        throw new Error("should not parse");
      },
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { useUserThemesStore } = await import("../userThemesStore");
    await useUserThemesStore.getState().loadFromDaemon();
    expect(useUserThemesStore.getState().themes).toEqual([]);
  });
});
