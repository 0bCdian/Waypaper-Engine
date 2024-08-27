import { create } from "zustand";
import { type Filters, type rendererImage } from "../types/rendererTypes";
import { type imagesObject } from "../../shared/types";
import { playlistStore } from "./playlist";
const { queryImages, deleteImagesFromGallery } = window.API_RENDERER;
const initialFilters: Filters = {
    order: "desc",
    type: "id",
    searchString: "",
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
            "farbfeld"
        ],
        resolution: {
            constraint: "all",
            width: 0,
            height: 0
        }
    }
};
interface State {
    imagesArray: rendererImage[];
    imagesMap: Map<number, rendererImage>;
    skeletonsToShow: imagesObject | undefined;
    filteredImages: rendererImage[];
    isEmpty: boolean;
    isQueried: boolean;
    filters: Filters;
    selectedImages: Set<number>;
    addImages: (newImages: rendererImage[]) => void;
    setFilters: (newFilters: Filters) => void;
    getFilters: () => Filters;
    setSkeletons: (skeletons: imagesObject | undefined) => void;
    setFilteredImages: (filteredImages: rendererImage[]) => void;
    setSelectedImages: (newSelectedImages: Set<number>) => void;
    clearSkeletons: () => void;
    removeImagesFromStore: (images: rendererImage[]) => void;
    reQueryImages: () => void;
    addToSelectedImages: (imageSelected: rendererImage) => void;
    removeFromSelectedImages: (imageSelected: rendererImage) => void;
    deleteSelectedImages: () => void;
    getSelectedImages: () => rendererImage[];
}

export const imagesStore = create<State>()((set, get) => ({
    imagesArray: [] as rendererImage[],
    imagesMap: new Map<number, rendererImage>(),
    skeletonsToShow: undefined,
    filteredImages: [] as rendererImage[],
    isEmpty: true,
    isQueried: false,
    filters: initialFilters,
    selectedImages: new Set<number>(),
    setFilters: newFilters => {
        set(() => ({ filters: newFilters }));
    },
    setFilteredImages: filteredImages => {
        set(() => ({ filteredImages }));
    },
    setSelectedImages: selectedImages => {
        set(() => ({ selectedImages }));
    },
    getSelectedImages: () => {
        const selectedImages: rendererImage[] = [];
        const imagesMap = get().imagesMap;
        const selectedImagesSet = get().selectedImages;
        selectedImagesSet.forEach(id => {
            const currentImage = imagesMap.get(id);
            if (currentImage !== undefined) {
                selectedImages.push(currentImage);
            }
        });
        return selectedImages;
    },
    addImages: newImages => {
        const filters = get().filters;
        let newImagesArray: rendererImage[] = [];
        if (filters.order === "desc") {
            newImagesArray = [...newImages, ...get().imagesArray];
        } else {
            newImagesArray = [...get().imagesArray, ...newImages];
        }
        const oldImagesMap = get().imagesMap;
        newImages.forEach(image => {
            oldImagesMap.set(image.id, image);
        });
        set(() => ({
            imagesArray: newImagesArray,
            imagesMap: new Map(oldImagesMap)
        }));
    },
    setSkeletons: skeletons => {
        set(() => ({ skeletonsToShow: skeletons, isEmpty: false }));
    },
    clearSkeletons: () => {
        set(() => ({ skeletonsToShow: undefined }));
    },
    removeImagesFromStore: images => {
        set(state => {
            const imagesMap = get().imagesMap;
            const selectedImages = get().selectedImages;
            const imagesSetToDelete = new Set<number>();
            images.forEach(imageToDelete => {
                imagesMap.delete(imageToDelete.id);
                selectedImages.delete(imageToDelete.id);
                imagesSetToDelete.add(imageToDelete.id);
            });
            playlistStore
                .getState()
                .removeImagesFromPlaylist(imagesSetToDelete);
            return {
                ...state,
                imagesArray: Array.from(imagesMap.values()),
                imagesMap: new Map(imagesMap)
            };
        });
    },
    reQueryImages: () => {
        void queryImages().then(images => {
            const isEmpty = images.length <= 0;
            const newImagesMap = new Map<number, rendererImage>();
            images.forEach(image => {
                newImagesMap.set(image.id, image);
            });
            set(() => ({
                imagesArray: images,
                isEmpty,
                isQueried: true,
                imagesMap: newImagesMap
            }));
        });
    },
    addToSelectedImages(imageSelected) {
        get().selectedImages.add(imageSelected.id);
        set(state => ({ selectedImages: new Set(state.selectedImages) }));
    },
    removeFromSelectedImages(imageSelected) {
        get().selectedImages.delete(imageSelected.id);
        set(state => ({ selectedImages: new Set(state.selectedImages) }));
    },
    deleteSelectedImages() {
        const imagesToDelete: rendererImage[] = [];
        const imagesSetToDelete = new Set<number>();
        const newImagesMap = new Map(get().imagesMap);
        const newSelectedImages = new Set(get().selectedImages);
        newSelectedImages.forEach(id => {
            const image = newImagesMap.get(id);
            if (image === undefined) return;
            newImagesMap.delete(id);
            newSelectedImages.delete(id);
            imagesToDelete.push(image);
            imagesSetToDelete.add(id);
        });
        void deleteImagesFromGallery(imagesToDelete).then(() => {
            set(() => ({
                imagesMap: newImagesMap,
                imagesArray: Array.from(newImagesMap.values()),
                selectedImages: newSelectedImages
            }));
            playlistStore
                .getState()
                .removeImagesFromPlaylist(imagesSetToDelete);
        });
    },
    getFilters() {
        return get().filters;
    }
}));
