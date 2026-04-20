import { vi, describe, it, expect, beforeEach } from "vitest";
import { act } from "@testing-library/react";
import { createMockAPI } from "../../test/mocks/apiRenderer";

describe("useSettingsStore", () => {
  let mockAPI: ReturnType<typeof createMockAPI>;

  beforeEach(() => {
    vi.resetModules();
    mockAPI = createMockAPI();
    Object.defineProperty(window, "API_RENDERER", {
      value: mockAPI,
      writable: true,
      configurable: true,
    });
  });

  async function getStore() {
    const mod = await import("../settingsStore");
    return mod.useSettingsStore;
  }

  it("loadConfig fetches from daemon and sets state", async () => {
    const useSettingsStore = await getStore();

    await act(async () => {
      await useSettingsStore.getState().loadConfig();
    });

    const state = useSettingsStore.getState();
    expect(state.config).not.toBeNull();
    expect(state.config!.app.theme).toBe("kolision-raw");
    expect(state.config!.app.font_preset).toBe("bundled");
    expect(state.config!.backend.type).toBe("awww");
    expect(state.isLoading).toBe(false);
    expect(mockAPI.goDaemon.getConfig).toHaveBeenCalled();
  });

  it("loadConfig handles error and falls back to default", async () => {
    mockAPI.goDaemon.getConfig = vi.fn().mockRejectedValue(new Error("daemon down"));

    const useSettingsStore = await getStore();

    await act(async () => {
      await useSettingsStore.getState().loadConfig();
    });

    const state = useSettingsStore.getState();
    expect(state.config).not.toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.errors).toHaveLength(1);
    expect(state.errors[0].message).toContain("Failed to load");
  });

  it("saveConfigSection updates local state and calls API", async () => {
    const useSettingsStore = await getStore();

    await act(async () => {
      await useSettingsStore.getState().loadConfig();
    });

    await act(async () => {
      await useSettingsStore.getState().saveConfigSection("app", { notifications: false });
    });

    const state = useSettingsStore.getState();
    expect(state.config!.app.notifications).toBe(false);
    expect(mockAPI.goDaemon.updateConfigSection).toHaveBeenCalledWith("app", {
      notifications: false,
    });
  });

  it("saveConfigSection handles backend type change", async () => {
    const useSettingsStore = await getStore();

    await act(async () => {
      await useSettingsStore.getState().loadConfig();
    });

    await act(async () => {
      await useSettingsStore.getState().saveConfigSection("backend", { type: "feh" });
    });

    const state = useSettingsStore.getState();
    expect(state.config!.backend.type).toBe("feh");
    expect(mockAPI.goDaemon.activateBackend).toHaveBeenCalledWith("feh");
  });

  it("saveConfigSection activates configured backend when switching selection_mode to fixed", async () => {
    const useSettingsStore = await getStore();

    await act(async () => {
      await useSettingsStore.getState().loadConfig();
    });

    mockAPI.goDaemon.activateBackend = vi.fn().mockResolvedValue({
      status: "activated",
      backend: "awww",
    });

    await act(async () => {
      await useSettingsStore.getState().saveConfigSection("backend", { selection_mode: "fixed" });
    });

    expect(mockAPI.goDaemon.updateConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        backend: expect.objectContaining({ selection_mode: "fixed" }),
      }),
    );
    expect(mockAPI.goDaemon.activateBackend).toHaveBeenCalledWith("awww");
  });

  it("saveBackendPatch merges locally and calls updateBackendConfig(name, patch)", async () => {
    const useSettingsStore = await getStore();

    await act(async () => {
      await useSettingsStore.getState().loadConfig();
    });

    await act(async () => {
      await useSettingsStore.getState().saveBackendPatch("awww", { resize: "fit" });
    });

    const state = useSettingsStore.getState();
    expect((state.config!.backend as unknown as Record<string, unknown>).awww).toMatchObject({
      resize: "fit",
    });
    expect(mockAPI.goDaemon.updateBackendConfig).toHaveBeenCalledWith("awww", { resize: "fit" });
  });

  it("resetToDefaults calls updateConfig with defaults", async () => {
    const useSettingsStore = await getStore();

    await act(async () => {
      await useSettingsStore.getState().loadConfig();
    });

    await act(async () => {
      await useSettingsStore.getState().resetToDefaults();
    });

    expect(mockAPI.goDaemon.updateConfig).toHaveBeenCalled();
    const state = useSettingsStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.isDirty).toBe(false);
  });

  it("setSearchTerm filters sections based on config keys", async () => {
    const useSettingsStore = await getStore();

    await act(async () => {
      await useSettingsStore.getState().loadConfig();
    });

    act(() => {
      useSettingsStore.getState().setSearchTerm("theme");
    });

    const state = useSettingsStore.getState();
    expect(state.searchTerm).toBe("theme");
    expect(state.filteredSections).toContain("app");
  });

  it("setSearchTerm includes backend from search index when config keys do not match", async () => {
    const useSettingsStore = await getStore();

    await act(async () => {
      await useSettingsStore.getState().loadConfig();
    });

    act(() => {
      useSettingsStore.getState().setSearchTerm("backend");
    });

    expect(useSettingsStore.getState().filteredSections).toContain("backend");
  });

  it("setSearchTerm multi-word query matches section via tokens (index + config)", async () => {
    const useSettingsStore = await getStore();

    await act(async () => {
      await useSettingsStore.getState().loadConfig();
    });

    act(() => {
      useSettingsStore.getState().setSearchTerm("backend settings");
    });

    expect(useSettingsStore.getState().filteredSections).toContain("backend");
  });

  it("setSearchTerm matches daemon log via separate tokens on keys", async () => {
    const useSettingsStore = await getStore();

    await act(async () => {
      await useSettingsStore.getState().loadConfig();
    });

    act(() => {
      useSettingsStore.getState().setSearchTerm("log file");
    });

    expect(useSettingsStore.getState().filteredSections).toContain("daemon");
  });

  it("clearSearch resets search term and shows all sections", async () => {
    const useSettingsStore = await getStore();

    await act(async () => {
      await useSettingsStore.getState().loadConfig();
    });

    act(() => {
      useSettingsStore.getState().setSearchTerm("theme");
    });
    act(() => {
      useSettingsStore.getState().clearSearch();
    });

    const state = useSettingsStore.getState();
    expect(state.searchTerm).toBe("");
    expect(state.filteredSections).toEqual(["app", "daemon", "backend", "monitors", "wallhaven"]);
  });

  it("setPendingBackendSettingsTab stores pending inner tab", async () => {
    const useSettingsStore = await getStore();

    act(() => {
      useSettingsStore.getState().setPendingBackendSettingsTab("wayland-utauri");
    });
    expect(useSettingsStore.getState().pendingBackendSettingsTab).toBe("wayland-utauri");

    act(() => {
      useSettingsStore.getState().clearPendingBackendSettingsTab();
    });
    expect(useSettingsStore.getState().pendingBackendSettingsTab).toBeNull();
  });

  it("toggleSection toggles expanded sections", async () => {
    const useSettingsStore = await getStore();

    expect(useSettingsStore.getState().expandedSections.has("app")).toBe(true);

    act(() => {
      useSettingsStore.getState().toggleSection("app");
    });
    expect(useSettingsStore.getState().expandedSections.has("app")).toBe(false);

    act(() => {
      useSettingsStore.getState().toggleSection("app");
    });
    expect(useSettingsStore.getState().expandedSections.has("app")).toBe(true);
  });
});
