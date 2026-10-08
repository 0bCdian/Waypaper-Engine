import { create } from "zustand";
import type { Filters, rendererImage } from "../types/rendererTypes";
import { usePlaylistStore } from "./playlist";
import type { Pagination, ImageQueryParams } from "../../electron/daemon-go-types";
import { useFoldersStore } from "./foldersStore";
import { logger } from "../utils/logger";
import {
  loadGalleryFiltersFromStorage,
  persistGalleryFilters,
} from "../utils/galleryFilterStorage";
import { mapFiltersToImageQueryParams } from "../utils/galleryFilterTokens";
import { daemonClient } from "@/client";

interface State {
  imagesArray: rendererImage[];
  imagesMap: Map<number, rendererImage>;
  isEmpty: boolean;
  isQueried: boolean;
  filters: Filters;
  selectedImages: Set<number>;
  pagination: Pagination | null;
  currentPage: number;
  perPage: number;
  setFilters: (newFilters: Filters) => void;
  setSelectedImages: (newSelectedImages: Set<number>) => void;
  reQueryImages: (params?: ImageQueryParams) => void;
  fetchPage: (page: number, extraParams?: Partial<ImageQueryParams>) => void;
  addToSelectedImages: (imageSelected: rendererImage) => void;
  removeFromSelectedImages: (imageSelected: rendererImage) => void;
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
  isEmpty: true,
  isQueried: false,
  filters: loadGalleryFiltersFromStorage(),
  selectedImages: new Set<number>(),
  pagination: null,
  currentPage: 1,
  perPage: 50,

  setFilters: (newFilters) => {
    set(() => ({ filters: newFilters }));
    persistGalleryFilters(newFilters);
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
  fetchPage: (page: number, extraParams?: Partial<ImageQueryParams>) => {
    set({ currentPage: page, isQueried: false });
    get().reQueryImages({ page, per_page: get().perPage, ...extraParams });
  },
  reQueryImages: (params?: ImageQueryParams) => {
    const currentFolderId = useFoldersStore.getState().currentFolderId;
    const currentFilters = get().filters;
    const filterQueryParams = mapFiltersToImageQueryParams(currentFilters);
    const mergedParams: ImageQueryParams = {
      page: get().currentPage,
      per_page: get().perPage,
      ...filterQueryParams,
      ...params,
    };
    if (mergedParams.folder_id === undefined && !mergedParams.search) {
      mergedParams.folder_id = currentFolderId === null ? "root" : currentFolderId;
    }
    void daemonClient
      .getImages(mergedParams)
      .then((response) => {
        if (!response || !response.data || !Array.isArray(response.data)) {
          logger.warn("ImagesStore: Invalid images response:", response);
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
        logger.error("ImagesStore: Error loading images:", error);
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
    set((state) => {
      const next = new Set(state.selectedImages);
      next.add(imageSelected.id);
      return { selectedImages: next };
    });
  },
  removeFromSelectedImages(imageSelected) {
    set((state) => {
      const next = new Set(state.selectedImages);
      next.delete(imageSelected.id);
      return { selectedImages: next };
    });
  },
  clearSelection() {
    set(() => ({ selectedImages: new Set<number>() }));
  },
  clearSelectionOnCurrentPage() {
    set((state) => {
      const pageIds = new Set(state.imagesArray.map((img) => img.id));
      const next = new Set(state.selectedImages);
      for (const id of pageIds) {
        next.delete(id);
      }
      return { selectedImages: next };
    });
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
    const updated = (await daemonClient.updateImage(id, {
      name: newName,
    })) as rendererImage;
    if (updated.time === undefined) {
      updated.time = null;
    }
    set((state) => ({
      imagesMap: new Map(state.imagesMap).set(id, updated),
      imagesArray: state.imagesArray.map((image) => (image.id === id ? updated : image)),
    }));
    return updated;
  },

  async fetchMissingImages(imageIds: number[]) {
    const currentMap = get().imagesMap;
    const missingIds = imageIds.filter((id) => !currentMap.has(id));
    if (missingIds.length === 0) return;

    const results = await Promise.allSettled(missingIds.map((id) => daemonClient.getImage(id)));

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
