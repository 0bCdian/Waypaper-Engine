import { vi, describe, it, expect, beforeEach } from "vitest";
import { act } from "@testing-library/react";
import { createMockAPI } from "../../test/mocks/apiRenderer";
import {
	sampleHistoryEntry,
	sampleImage,
} from "../../test/mocks/fixtures";

describe("useHistoryStore", () => {
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
		const mod = await import("../historyStore");
		return mod.useHistoryStore;
	}

	it("fetchHistory calls getImageHistory and resolves images", async () => {
		const entries = [sampleHistoryEntry(1), sampleHistoryEntry(2)];
		mockAPI.goDaemon.getImageHistory = vi.fn().mockResolvedValue(entries);
		mockAPI.goDaemon.getImage = vi
			.fn()
			.mockImplementation((id: number) =>
				Promise.resolve(sampleImage(id)),
			);

		const useHistoryStore = await getStore();

		await act(async () => {
			await useHistoryStore.getState().fetchHistory();
		});

		const state = useHistoryStore.getState();
		expect(state.entries).toHaveLength(2);
		expect(state.imageCache.size).toBe(2);
		expect(state.isLoading).toBe(false);
		expect(mockAPI.goDaemon.getImageHistory).toHaveBeenCalledWith(50);
	});

	it("fetchHistory handles error", async () => {
		mockAPI.goDaemon.getImageHistory = vi
			.fn()
			.mockRejectedValue(new Error("fetch failed"));

		const useHistoryStore = await getStore();

		await act(async () => {
			await useHistoryStore.getState().fetchHistory();
		});

		const state = useHistoryStore.getState();
		expect(state.entries).toHaveLength(0);
		expect(state.isLoading).toBe(false);
	});

	it("loadMore appends older entries", async () => {
		const initial = [
			sampleHistoryEntry(10, { set_at: "2025-01-02T00:00:00Z" }),
			sampleHistoryEntry(9, { set_at: "2025-01-01T00:00:00Z" }),
		];
		mockAPI.goDaemon.getImageHistory = vi.fn().mockResolvedValue(initial);
		mockAPI.goDaemon.getImage = vi
			.fn()
			.mockImplementation((id: number) =>
				Promise.resolve(sampleImage(id)),
			);

		const useHistoryStore = await getStore();

		await act(async () => {
			await useHistoryStore.getState().fetchHistory();
		});
		expect(useHistoryStore.getState().entries).toHaveLength(2);

		const olderEntries = [
			...initial,
			sampleHistoryEntry(5, { set_at: "2024-12-31T00:00:00Z" }),
		];
		mockAPI.goDaemon.getImageHistory = vi
			.fn()
			.mockResolvedValue(olderEntries);

		await act(async () => {
			await useHistoryStore.getState().loadMore();
		});

		const state = useHistoryStore.getState();
		expect(state.entries.length).toBeGreaterThanOrEqual(3);
	});

	it("clearHistory calls API and resets", async () => {
		const entries = [sampleHistoryEntry(1)];
		mockAPI.goDaemon.getImageHistory = vi.fn().mockResolvedValue(entries);
		mockAPI.goDaemon.getImage = vi
			.fn()
			.mockImplementation((id: number) =>
				Promise.resolve(sampleImage(id)),
			);
		mockAPI.goDaemon.clearImageHistory = vi
			.fn()
			.mockResolvedValue({ status: "cleared" });

		const useHistoryStore = await getStore();

		await act(async () => {
			await useHistoryStore.getState().fetchHistory();
		});
		expect(useHistoryStore.getState().entries).toHaveLength(1);

		await act(async () => {
			await useHistoryStore.getState().clearHistory();
		});

		const state = useHistoryStore.getState();
		expect(state.entries).toHaveLength(0);
		expect(state.imageCache.size).toBe(0);
		expect(state.hasMore).toBe(false);
		expect(mockAPI.goDaemon.clearImageHistory).toHaveBeenCalled();
	});

	it("reset clears state synchronously", async () => {
		const entries = [sampleHistoryEntry(1)];
		mockAPI.goDaemon.getImageHistory = vi.fn().mockResolvedValue(entries);
		mockAPI.goDaemon.getImage = vi
			.fn()
			.mockImplementation((id: number) =>
				Promise.resolve(sampleImage(id)),
			);

		const useHistoryStore = await getStore();

		await act(async () => {
			await useHistoryStore.getState().fetchHistory();
		});

		act(() => {
			useHistoryStore.getState().reset();
		});

		const state = useHistoryStore.getState();
		expect(state.entries).toHaveLength(0);
		expect(state.imageCache.size).toBe(0);
		expect(state.isLoading).toBe(false);
		expect(state.hasMore).toBe(true);
	});
});
