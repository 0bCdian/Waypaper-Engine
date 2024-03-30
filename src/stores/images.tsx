import { create } from 'zustand';
import { type Filters, type rendererImage } from '../types/rendererTypes';
import { type imagesObject } from '../../shared/types';

const { queryImages, deleteImagesFromGallery } = window.API_RENDERER;
const initialFilters: Filters = {
    order: 'desc',
    type: 'id',
    searchString: '',
    advancedFilters: {
        formats: [
            'jpeg',
            'jpg',
            'webp',
            'gif',
            'png',
            'bmp',
            'tiff',
            'tga',
            'pnm',
            'farbfeld'
        ],
        resolution: {
            constraint: 'all',
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
    resetImageCheckboxes: () => void;
    clearSkeletons: () => void;
    removeImagesFromStore: (images: rendererImage[]) => void;
    reQueryImages: () => void;
    addSelectedImage: (imageSelected: rendererImage) => void;
    removeSelectedImage: (imageSelected: rendererImage) => void;
    deleteSelectedImages: () => void;
    getSelectedImages: () => Set<number>;
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
        return get().selectedImages;
    },
    addImages: newImages => {
        const filters = get().filters;
        let newImagesArray: rendererImage[] = [];
        if (filters.order === 'desc') {
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
        set(() => ({ skeletonsToShow: skeletons }));
    },
    resetImageCheckboxes: () => {
        set(state => {
            const resetImages = state.imagesArray.map(image => {
                image.isChecked = false;
                return image;
            });
            return { ...state, imagesArray: resetImages };
        });
    },
    clearSkeletons: () => {
        set(() => ({ skeletonsToShow: undefined }));
    },
    removeImagesFromStore: images => {
        set(state => {
            const imagesMap = get().imagesMap;
            const selectedImages = get().selectedImages;
            images.forEach(imageToDelete => {
                imagesMap.delete(imageToDelete.id);
                selectedImages.delete(imageToDelete.id);
            });

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
    addSelectedImage(imageSelected) {
        get().selectedImages.add(imageSelected.id);
        set(state => ({ selectedImages: new Set(state.selectedImages) }));
    },
    removeSelectedImage(imageSelected) {
        get().selectedImages.delete(imageSelected.id);
        set(state => ({ selectedImages: new Set(state.selectedImages) }));
    },
    deleteSelectedImages() {
        const selectedImages: rendererImage[] = [];
        const imagesMap = get().imagesMap;
        get().selectedImages.forEach(id => {
            const image = imagesMap.get(id);
            imagesMap.delete(id);
            if (image === undefined) return;
            selectedImages.push(image);
        });
        void deleteImagesFromGallery(selectedImages).then(() => {
            get().removeImagesFromStore(selectedImages);
        });
    },
    getFilters() {
        return get().filters;
    }
}));
