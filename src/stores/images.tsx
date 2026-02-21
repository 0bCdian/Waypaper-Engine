import { create } from "zustand";
import type { Filters, rendererImage } from "../types/rendererTypes";
import { usePlaylistStore } from "./playlist";
import type {
	Pagination,
	ImageQueryParams,
} from "../../electron/daemon-go-types";

const { goDaemon } = window.API_RENDERER;

const initialFilters: Filters = {
	order: "desc",
	type: "id",
	searchString: "",
	tags: [],
	advancedFilters: {
		formats: [
			"jpeg",
			"jpg",
			"webp",
			"gif",
			"png",
			"bmp",
			"tiff",
			"tga",
			"pnm",
			"farbfeld",
		],
		resolution: {
			constraint: "all",
			width: 0,
			height: 0,
		},
		colors: [],
	},
};

interface State {
	imagesArray: rendererImage[];
	imagesMap: Map<number, rendererImage>;
	filteredImages: rendererImage[];
	isEmpty: boolean;
	isQueried: boolean;
	filters: Filters;
	selectedImages: Set<number>;
	pagination: Pagination | null;
	currentPage: number;
	perPage: number;
	currentFolderId: number | null;
	addImages: (newImages: rendererImage[]) => void;
	addImage: (newImage: rendererImage) => void;
	setFilters: (newFilters: Filters) => void;
	getFilters: () => Filters;
	setFilteredImages: (filteredImages: rendererImage[]) => void;
	setSelectedImages: (newSelectedImages: Set<number>) => void;
	removeImagesFromStore: (images: rendererImage[]) => void;
	reQueryImages: (params?: ImageQueryParams) => void;
	setCurrentPage: (page: number) => void;
	fetchPage: (page: number, extraParams?: Partial<ImageQueryParams>) => void;
	addToSelectedImages: (imageSelected: rendererImage) => void;
	removeFromSelectedImages: (imageSelected: rendererImage) => void;
	deleteSelectedImages: () => void;
	getSelectedImages: () => rendererImage[];
	clearSelection: () => void;
	clearSelectionOnCurrentPage: () => void;
	selectAllImagesInCurrentPage: () => void;
	selectAllImagesInGallery: () => void;
	renameImage: (id: number, newName: string) => Promise<rendererImage>;
	fetchMissingImages: (imageIds: number[]) => Promise<void>;
}

export const useImagesStore = create<State>()((set, get) => ({
	imagesArray: [] as rendererImage[],
	imagesMap: new Map<number, rendererImage>(),
	filteredImages: [] as rendererImage[],
	isEmpty: true,
	isQueried: false,
	filters: initialFilters,
	selectedImages: new Set<number>(),
	pagination: null,
	currentPage: 1,
	perPage: 50,
	currentFolderId: null,

	setFilters: (newFilters) => {
		set(() => ({ filters: newFilters }));
	},
	setFilteredImages: (filteredImages) => {
		set(() => ({ filteredImages }));
	},
	setSelectedImages: (selectedImages) => {
		set(() => ({ selectedImages }));
	},
	getSelectedImages: () => {
		const selectedImages: rendererImage[] = [];
		const imagesMap = get().imagesMap;
		const selectedImagesSet = get().selectedImages;
		selectedImagesSet.forEach((id) => {
			const currentImage = imagesMap.get(id);
			if (currentImage !== undefined) {
				selectedImages.push(currentImage);
			}
		});
		return selectedImages;
	},
	addImages: (newImages) => {
		const filters = get().filters;
		let newImagesArray: rendererImage[];
		if (filters.order === "desc") {
			newImagesArray = [...newImages, ...get().imagesArray];
		} else {
			newImagesArray = [...get().imagesArray, ...newImages];
		}
		const oldImagesMap = get().imagesMap;
		newImages.forEach((image) => {
			oldImagesMap.set(image.id, image);
		});
		set(() => ({
			imagesArray: newImagesArray,
			imagesMap: new Map(oldImagesMap),
		}));
	},
	addImage: (newImage) => {
		const filters = get().filters;
		const currentArray = get().imagesArray;

		let newImagesArray: rendererImage[];
		if (filters.order === "desc") {
			newImagesArray = [newImage, ...currentArray];
		} else {
			newImagesArray = [...currentArray, newImage];
		}

		const oldImagesMap = get().imagesMap;
		oldImagesMap.set(newImage.id, newImage);
		set(() => ({
			imagesArray: newImagesArray,
			imagesMap: new Map(oldImagesMap),
			isEmpty: false,
		}));
	},
	removeImagesFromStore: (images) => {
		set((state) => {
			const imagesMap = get().imagesMap;
			const selectedImages = get().selectedImages;
			const imagesSetToDelete = new Set<number>();
			images.forEach((imageToDelete) => {
				imagesMap.delete(imageToDelete.id);
				selectedImages.delete(imageToDelete.id);
				imagesSetToDelete.add(imageToDelete.id);
			});
			usePlaylistStore.getState().removeImagesFromPlaylist(imagesSetToDelete);
			return {
				...state,
				imagesArray: Array.from(imagesMap.values()),
				imagesMap: new Map(imagesMap),
			};
		});
	},
	setCurrentPage: (page: number) => {
		set({ currentPage: page });
	},
	fetchPage: (page: number, extraParams?: Partial<ImageQueryParams>) => {
		set({ currentPage: page, isQueried: false });
		get().reQueryImages({ page, per_page: get().perPage, ...extraParams });
	},
	reQueryImages: (params?: ImageQueryParams) => {
		const currentFolderId = get().currentFolderId;
		const mergedParams: ImageQueryParams = {
			page: get().currentPage,
			per_page: get().perPage,
			...params,
		};
		if (mergedParams.folder_id === undefined && !mergedParams.search) {
			mergedParams.folder_id = currentFolderId === null ? "root" : currentFolderId;
		}
		void goDaemon
			.getImages(mergedParams)
			.then((response) => {
				if (!response || !response.data || !Array.isArray(response.data)) {
					console.warn("ImagesStore: Invalid images response:", response);
					set(() => ({
						imagesArray: [],
						isEmpty: true,
						isQueried: true,
						imagesMap: new Map<number, rendererImage>(),
						pagination: null,
					}));
					return;
				}

				const images = response.data as rendererImage[];
				const isEmpty = images.length <= 0;
				const newImagesMap = new Map<number, rendererImage>();

				images.forEach((image) => {
					if (image.time === undefined) {
						image.time = null;
					}
					newImagesMap.set(image.id, image);
				});

				const oldMap = get().imagesMap;
				const playlistImageIds = usePlaylistStore.getState().playlist.images;
				for (const pImg of playlistImageIds) {
					if (!newImagesMap.has(pImg.image_id)) {
						const cached = oldMap.get(pImg.image_id);
						if (cached) newImagesMap.set(pImg.image_id, cached);
					}
				}

				set(() => ({
					imagesArray: images,
					isEmpty,
					isQueried: true,
					imagesMap: newImagesMap,
					pagination: response.pagination,
				}));
			})
			.catch((error) => {
				console.error("ImagesStore: Error loading images:", error);
				set(() => ({
					imagesArray: [],
					isEmpty: true,
					isQueried: true,
					imagesMap: new Map<number, rendererImage>(),
					pagination: null,
				}));
			});
	},
	addToSelectedImages(imageSelected) {
		get().selectedImages.add(imageSelected.id);
		set((state) => ({ selectedImages: new Set(state.selectedImages) }));
	},
	removeFromSelectedImages(imageSelected) {
		get().selectedImages.delete(imageSelected.id);
		set((state) => ({ selectedImages: new Set(state.selectedImages) }));
	},
	deleteSelectedImages() {
		const imagesToDelete: rendererImage[] = [];
		const imagesSetToDelete = new Set<number>();
		const newImagesMap = new Map(get().imagesMap);
		const newSelectedImages = new Set(get().selectedImages);
		newSelectedImages.forEach((id) => {
			const image = newImagesMap.get(id);
			if (image === undefined) return;
			newImagesMap.delete(id);
			newSelectedImages.delete(id);
			imagesToDelete.push(image);
			imagesSetToDelete.add(id);
		});
		void goDaemon.deleteImages(imagesToDelete.map((img) => img.id)).then(() => {
			set(() => ({
				imagesMap: newImagesMap,
				imagesArray: Array.from(newImagesMap.values()),
				selectedImages: newSelectedImages,
			}));
			usePlaylistStore.getState().removeImagesFromPlaylist(imagesSetToDelete);
		});
	},
	getFilters() {
		return get().filters;
	},
	clearSelection() {
		set(() => ({ selectedImages: new Set<number>() }));
	},
	clearSelectionOnCurrentPage() {
		set(() => ({ selectedImages: new Set<number>() }));
	},
	selectAllImagesInCurrentPage() {
		const allImageIds = new Set(get().imagesArray.map((img) => img.id));
		set(() => ({ selectedImages: allImageIds }));
	},
	selectAllImagesInGallery() {
		const allImageIds = new Set(get().imagesArray.map((img) => img.id));
		set(() => ({ selectedImages: allImageIds }));
	},
	async renameImage(id: number, newName: string): Promise<rendererImage> {
		const updated = (await goDaemon.renameImage(id, newName)) as rendererImage;
		if (updated.time === undefined) {
			updated.time = null;
		}
		const imagesMap = new Map(get().imagesMap);
		imagesMap.set(id, updated);
		set(() => ({
			imagesMap,
			imagesArray: Array.from(imagesMap.values()),
		}));
		return updated;
	},

	async fetchMissingImages(imageIds: number[]) {
		const currentMap = get().imagesMap;
		const missingIds = imageIds.filter((id) => !currentMap.has(id));
		if (missingIds.length === 0) return;

		const results = await Promise.allSettled(
			missingIds.map((id) => goDaemon.getImage(id)),
		);

		const fetched: rendererImage[] = [];
		for (const result of results) {
			if (result.status === "fulfilled" && result.value) {
				const img = result.value as rendererImage;
				if (img.time === undefined) {
					img.time = null;
				}
				fetched.push(img);
			}
		}

		if (fetched.length === 0) return;

		const updatedMap = new Map(get().imagesMap);
		for (const img of fetched) {
			updatedMap.set(img.id, img);
		}
		set(() => ({ imagesMap: updatedMap }));
	},
}));
