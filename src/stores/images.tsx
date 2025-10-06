import { create } from "zustand";
import { type Filters, type rendererImage } from "../types/rendererTypes";
import { type imagesObject } from "../../shared/types";
import { playlistStore } from "./playlist";
const { goDaemon } = window.API_RENDERER;
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
    filteredImages: rendererImage[];
    isEmpty: boolean;
    isQueried: boolean;
    filters: Filters;
    selectedImages: Set<number>;
    addImages: (newImages: rendererImage[]) => void;
    addImage: (newImage: rendererImage) => void;
    setFilters: (newFilters: Filters) => void;
    getFilters: () => Filters;
    setFilteredImages: (filteredImages: rendererImage[]) => void;
    setSelectedImages: (newSelectedImages: Set<number>) => void;
    removeImagesFromStore: (images: rendererImage[]) => void;
    reQueryImages: () => void;
    addToSelectedImages: (imageSelected: rendererImage) => void;
    removeFromSelectedImages: (imageSelected: rendererImage) => void;
    deleteSelectedImages: () => void;
    getSelectedImages: () => rendererImage[];
    clearSelection: () => void;
    clearSelectionOnCurrentPage: () => void;
    selectAllImagesInCurrentPage: () => void;
    selectAllImagesInGallery: () => void;
}

export const imagesStore = create<State>()((set, get) => ({
    imagesArray: [] as rendererImage[],
    imagesMap: new Map<number, rendererImage>(),
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
    addImage: newImage => {
        console.log("🟣 ImagesStore.addImage: Called with image:", newImage.name, "ID:", newImage.id);
        const filters = get().filters;
        const currentArray = get().imagesArray;
        console.log("🟣 ImagesStore.addImage: Current array length:", currentArray.length);
        
        let newImagesArray: rendererImage[] = [];
        if (filters.order === "desc") {
            newImagesArray = [newImage, ...currentArray];
            console.log("🟣 ImagesStore.addImage: Adding to beginning (desc order)");
        } else {
            newImagesArray = [...currentArray, newImage];
            console.log("🟣 ImagesStore.addImage: Adding to end (asc order)");
        }
        
        const oldImagesMap = get().imagesMap;
        oldImagesMap.set(newImage.id, newImage);
        console.log("🟣 ImagesStore.addImage: New array length:", newImagesArray.length, "Map size:", oldImagesMap.size);
        
        set(() => ({
            imagesArray: newImagesArray,
            imagesMap: new Map(oldImagesMap),
            isEmpty: false
        }));
        
        console.log("🟣 ImagesStore.addImage: State updated successfully");
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
        // Use Go daemon instead of direct database query
        void goDaemon.getImages().then(images => {
            console.log("🔵 ImagesStore: Received images from Go daemon:", images);
            
            // Handle null or undefined response
            if (!images || !Array.isArray(images)) {
                console.warn("🔴 ImagesStore: Received null or invalid images response:", images);
                set(() => ({
                    imagesArray: [],
                    isEmpty: true,
                    isQueried: true,
                    imagesMap: new Map<number, rendererImage>()
                }));
                return;
            }
            
            const isEmpty = images.length <= 0;
            const newImagesMap = new Map<number, rendererImage>();
            images.forEach(image => {
                console.log("🔵 ImagesStore: Processing image:", image);
                console.log("🔵 ImagesStore: Image name:", image.name, "Type:", typeof image.name);
                if (!image.name) {
                    console.error("🔴 ImagesStore: Image has no name!", image);
                }
                
                // Ensure image has selection property with default values
                if (!image.selection) {
                    image.selection = {
                        isChecked: false,
                        isSelected: false,
                        selectedAt: undefined,
                        selectedPlaylists: []
                    };
                }
                
                newImagesMap.set(image.id, image);
            });
            set(() => ({
                imagesArray: images,
                isEmpty,
                isQueried: true,
                imagesMap: newImagesMap
            }));
            console.log("🔵 ImagesStore: Set images in store, count:", images.length);
        }).catch(error => {
            console.error("🔴 ImagesStore: Error loading images:", error);
            // Set empty state on error
            set(() => ({
                imagesArray: [],
                isEmpty: true,
                isQueried: true,
                imagesMap: new Map<number, rendererImage>()
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
        void goDaemon.deleteImagesFromGallery(imagesToDelete.map(img => img.id)).then(() => {
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
    },
    clearSelection() {
        set(() => ({ selectedImages: new Set<number>() }));
    },
    clearSelectionOnCurrentPage() {
        // This would need to be implemented with pagination context
        // For now, just clear all selection
        set(() => ({ selectedImages: new Set<number>() }));
    },
    selectAllImagesInCurrentPage() {
        // This would need to be implemented with pagination context
        // For now, select all images
        const allImageIds = new Set(get().imagesArray.map(img => img.id));
        set(() => ({ selectedImages: allImageIds }));
    },
    selectAllImagesInGallery() {
        const allImageIds = new Set(get().imagesArray.map(img => img.id));
        set(() => ({ selectedImages: allImageIds }));
    }
}));
