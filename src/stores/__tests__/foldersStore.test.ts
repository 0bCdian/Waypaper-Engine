import { vi, describe, it, expect, beforeEach } from "vitest";
import { act } from "@testing-library/react";
import { createMockAPI } from "../../test/mocks/apiRenderer";
import { sampleFolder } from "../../test/mocks/fixtures";

describe("useFoldersStore", () => {
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
		const mod = await import("../foldersStore");
		return mod.useFoldersStore;
	}

	it("fetchFolders calls getFolders and sets state", async () => {
		const folders = [sampleFolder(1, "Alpha"), sampleFolder(2, "Beta")];
		mockAPI.goDaemon.getFolders = vi
			.fn()
			.mockResolvedValue({ data: folders });
		mockAPI.goDaemon.getImages = vi.fn().mockResolvedValue({
			data: [],
			pagination: { page: 1, per_page: 4, total_items: 0, total_pages: 0 },
		});

		const useFoldersStore = await getStore();

		await act(async () => {
			await useFoldersStore.getState().fetchFolders(null);
		});

		const state = useFoldersStore.getState();
		expect(mockAPI.goDaemon.getFolders).toHaveBeenCalledWith(null);
		expect(state.folders).toHaveLength(2);
		expect(state.folders[0].name).toBe("Alpha");
		expect(state.isLoading).toBe(false);
	});

	it("navigateToFolder sets currentFolderId and fetches", async () => {
		mockAPI.goDaemon.getFolders = vi
			.fn()
			.mockResolvedValue({ data: [] });
		mockAPI.goDaemon.getFolderPath = vi
			.fn()
			.mockResolvedValue({ data: [] });

		const useFoldersStore = await getStore();

		await act(async () => {
			useFoldersStore.getState().navigateToFolder(5);
			await vi.waitFor(() => {
				expect(mockAPI.goDaemon.getFolders).toHaveBeenCalled();
			});
		});

		expect(useFoldersStore.getState().currentFolderId).toBe(5);
		expect(mockAPI.goDaemon.getFolders).toHaveBeenCalledWith(5);
	});

	it("createFolder calls API and appends to state", async () => {
		const newFolder = sampleFolder(10, "New Folder");
		mockAPI.goDaemon.createFolder = vi.fn().mockResolvedValue(newFolder);

		const useFoldersStore = await getStore();

		await act(async () => {
			const result = await useFoldersStore
				.getState()
				.createFolder("New Folder", null);
			expect(result.name).toBe("New Folder");
		});

		expect(mockAPI.goDaemon.createFolder).toHaveBeenCalledWith(
			"New Folder",
			null,
		);
		const state = useFoldersStore.getState();
		expect(state.folders).toHaveLength(1);
		expect(state.folders[0].id).toBe(10);
	});

	it("renameFolder updates folder in state", async () => {
		const original = sampleFolder(1, "Old Name");
		const renamed = sampleFolder(1, "New Name");
		mockAPI.goDaemon.getFolders = vi
			.fn()
			.mockResolvedValue({ data: [original] });
		mockAPI.goDaemon.getImages = vi.fn().mockResolvedValue({
			data: [],
			pagination: { page: 1, per_page: 4, total_items: 0, total_pages: 0 },
		});
		mockAPI.goDaemon.updateFolder = vi.fn().mockResolvedValue(renamed);

		const useFoldersStore = await getStore();

		await act(async () => {
			await useFoldersStore.getState().fetchFolders(null);
		});

		await act(async () => {
			await useFoldersStore.getState().renameFolder(1, "New Name");
		});

		const state = useFoldersStore.getState();
		expect(state.folders[0].name).toBe("New Name");
		expect(mockAPI.goDaemon.updateFolder).toHaveBeenCalledWith(1, {
			name: "New Name",
		});
	});

	it("deleteFolder removes from state", async () => {
		const folder = sampleFolder(1, "To Delete");
		mockAPI.goDaemon.getFolders = vi
			.fn()
			.mockResolvedValue({ data: [folder] });
		mockAPI.goDaemon.getImages = vi.fn().mockResolvedValue({
			data: [],
			pagination: { page: 1, per_page: 4, total_items: 0, total_pages: 0 },
		});
		mockAPI.goDaemon.deleteFolder = vi
			.fn()
			.mockResolvedValue({ deleted: true, mode: "keep_contents" });

		const useFoldersStore = await getStore();

		await act(async () => {
			await useFoldersStore.getState().fetchFolders(null);
		});
		expect(useFoldersStore.getState().folders).toHaveLength(1);

		await act(async () => {
			await useFoldersStore.getState().deleteFolder(1, "keep_contents");
		});

		expect(useFoldersStore.getState().folders).toHaveLength(0);
		expect(mockAPI.goDaemon.deleteFolder).toHaveBeenCalledWith(
			1,
			"keep_contents",
		);
	});

	it("searchFolders returns results", async () => {
		const results = [sampleFolder(3, "Nature")];
		mockAPI.goDaemon.getFolders = vi
			.fn()
			.mockResolvedValue({ data: results });

		const useFoldersStore = await getStore();

		await act(async () => {
			await useFoldersStore.getState().searchFolders("Nature");
		});

		expect(useFoldersStore.getState().searchResults).toHaveLength(1);
		expect(useFoldersStore.getState().searchResults[0].name).toBe("Nature");
	});

	it("clearSearchResults empties array", async () => {
		const results = [sampleFolder(3, "Nature")];
		mockAPI.goDaemon.getFolders = vi
			.fn()
			.mockResolvedValue({ data: results });

		const useFoldersStore = await getStore();

		await act(async () => {
			await useFoldersStore.getState().searchFolders("Nature");
		});
		expect(useFoldersStore.getState().searchResults).toHaveLength(1);

		act(() => {
			useFoldersStore.getState().clearSearchResults();
		});

		expect(useFoldersStore.getState().searchResults).toHaveLength(0);
	});
});
