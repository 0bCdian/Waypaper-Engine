import { create } from "zustand";

export interface WallhavenThumb {
	large: string;
	original: string;
	small: string;
}

export interface WallhavenWallpaper {
	id: string;
	url: string;
	short_url: string;
	views: number;
	favorites: number;
	source: string;
	purity: string;
	category: string;
	dimension_x: number;
	dimension_y: number;
	resolution: string;
	ratio: string;
	file_size: number;
	file_type: string;
	created_at: string;
	colors: string[];
	path: string;
	thumbs: WallhavenThumb;
	tags?: Array<{ id: number; name: string; purity: string }>;
}

export interface WallhavenSearchMeta {
	current_page: number;
	last_page: number;
	per_page: number;
	total: number;
}

export interface WallhavenSearchResponse {
	data: WallhavenWallpaper[];
	meta: WallhavenSearchMeta;
}

export type WallhavenCategory = "general" | "anime" | "people";
export type WallhavenPurity = "sfw" | "sketchy" | "nsfw";
export type WallhavenSorting =
	| "date_added"
	| "relevance"
	| "random"
	| "views"
	| "favorites"
	| "toplist";

interface WallhavenFilters {
	query: string;
	categories: Record<WallhavenCategory, boolean>;
	purity: Record<WallhavenPurity, boolean>;
	sorting: WallhavenSorting;
	page: number;
}

interface WallhavenState {
	filters: WallhavenFilters;
	results: WallhavenWallpaper[];
	meta: WallhavenSearchMeta | null;
	isLoading: boolean;
	error: string | null;
	selectedWallpaper: WallhavenWallpaper | null;
	downloadingIds: Set<string>;
}

interface WallhavenActions {
	setQuery: (query: string) => void;
	toggleCategory: (cat: WallhavenCategory) => void;
	togglePurity: (pur: WallhavenPurity) => void;
	setSorting: (sorting: WallhavenSorting) => void;
	setPage: (page: number) => void;
	search: (apiKey?: string) => Promise<void>;
	selectWallpaper: (wp: WallhavenWallpaper | null) => void;
	downloadToGallery: (wp: WallhavenWallpaper) => Promise<void>;
}

function buildCategoryString(cats: Record<WallhavenCategory, boolean>): string {
	return `${cats.general ? "1" : "0"}${cats.anime ? "1" : "0"}${cats.people ? "1" : "0"}`;
}

function buildPurityString(pur: Record<WallhavenPurity, boolean>): string {
	return `${pur.sfw ? "1" : "0"}${pur.sketchy ? "1" : "0"}${pur.nsfw ? "1" : "0"}`;
}

const defaultFilters: WallhavenFilters = {
	query: "",
	categories: { general: true, anime: true, people: true },
	purity: { sfw: true, sketchy: false, nsfw: false },
	sorting: "date_added",
	page: 1,
};

export const useWallhavenStore = create<WallhavenState & WallhavenActions>()(
	(set, get) => ({
		filters: defaultFilters,
		results: [],
		meta: null,
		isLoading: false,
		error: null,
		selectedWallpaper: null,
		downloadingIds: new Set(),

		setQuery: (query) =>
			set((s) => ({ filters: { ...s.filters, query, page: 1 } })),

		toggleCategory: (cat) =>
			set((s) => ({
				filters: {
					...s.filters,
					categories: {
						...s.filters.categories,
						[cat]: !s.filters.categories[cat],
					},
					page: 1,
				},
			})),

		togglePurity: (pur) =>
			set((s) => ({
				filters: {
					...s.filters,
					purity: { ...s.filters.purity, [pur]: !s.filters.purity[pur] },
					page: 1,
				},
			})),

		setSorting: (sorting) =>
			set((s) => ({ filters: { ...s.filters, sorting, page: 1 } })),

		setPage: (page) =>
			set((s) => ({ filters: { ...s.filters, page } })),

		search: async (apiKey) => {
			const { filters } = get();
			set({ isLoading: true, error: null });

			try {
				const params: Record<string, string> = {
					categories: buildCategoryString(filters.categories),
					purity: buildPurityString(filters.purity),
					sorting: filters.sorting,
					page: String(filters.page),
				};
				if (filters.query) params.q = filters.query;
				if (apiKey) params.apikey = apiKey;

				const raw = (await window.API_RENDERER.wallhaven.search(
					params,
				)) as WallhavenSearchResponse;

				set({
					results: raw.data,
					meta: raw.meta,
					isLoading: false,
				});
			} catch (err) {
				set({
					error:
						err instanceof Error ? err.message : "Search failed",
					isLoading: false,
				});
			}
		},

		selectWallpaper: (wp) => set({ selectedWallpaper: wp }),

		downloadToGallery: async (wp) => {
			const { downloadingIds } = get();
			if (downloadingIds.has(wp.id)) return;

			set({ downloadingIds: new Set([...downloadingIds, wp.id]) });

			try {
				const tmpPath = await window.API_RENDERER.wallhaven.download(
					wp.path,
				);
				await window.API_RENDERER.goDaemon.importImages([tmpPath]);
			} catch (err) {
				console.error("Wallhaven download failed:", err);
			} finally {
				set((s) => {
					const next = new Set(s.downloadingIds);
					next.delete(wp.id);
					return { downloadingIds: next };
				});
			}
		},
	}),
);
