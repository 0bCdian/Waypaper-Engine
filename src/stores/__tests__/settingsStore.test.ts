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
		expect(state.config!.app.theme).toBe("dark");
		expect(state.config!.backend.type).toBe("swww");
		expect(state.isLoading).toBe(false);
		expect(mockAPI.goDaemon.getConfig).toHaveBeenCalled();
	});

	it("loadConfig handles error and falls back to default", async () => {
		mockAPI.goDaemon.getConfig = vi
			.fn()
			.mockRejectedValue(new Error("daemon down"));

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
			await useSettingsStore
				.getState()
				.saveConfigSection("app", { notifications: false });
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
			await useSettingsStore
				.getState()
				.saveConfigSection("backend", { type: "feh" });
		});

		const state = useSettingsStore.getState();
		expect(state.config!.backend.type).toBe("feh");
		expect(mockAPI.goDaemon.activateBackend).toHaveBeenCalledWith("feh");
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
		expect(state.filteredSections).toEqual([
			"app",
			"daemon",
			"backend",
			"monitors",
			"wallhaven",
		]);
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
