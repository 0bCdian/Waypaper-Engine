import { create } from 'zustand';
import { type Filters, type rendererImage } from '../types/rendererTypes';
import { type imagesObject } from '../../shared/types';

const { queryImages } = window.API_RENDERER;
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
    filters: Filters;
    isQueried: boolean;
    selectedImages: Set<number>;
    addImages: (newImages: rendererImage[]) => void;
    setFilters: (newFilters: Filters) => void;
    setSkeletons: (skeletons: imagesObject | undefined) => void;
    setFilteredImages: (filteredImages: rendererImage[]) => void;
    resetImageCheckboxes: () => void;
    clearSkeletons: () => void;
    removeImageFromStore: (imageID: number) => void;
    reQueryImages: () => void;
    addSelectedImage: (imageSelected: rendererImage) => void;
    removeSelectedImage: (imageSelected: rendererImage) => void;
}

export const imagesStore = create<State>()((set, get) => ({
    isQueried: false,
    imagesArray: [] as rendererImage[],
    imagesMap: new Map<number, rendererImage>(),
    skeletonsToShow: undefined,
    filteredImages: [] as rendererImage[],
    isEmpty: true,
    filters: initialFilters,
    selectedImages: new Set<number>(),
    setFilters: newFilters => {
        set(() => ({ filters: newFilters }));
    },
    setFilteredImages: filteredImages => {
        set(() => ({ filteredImages }));
    },
    addImages: newImages => {
        const newImagesArray = [...get().imagesArray, ...newImages];
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
    removeImageFromStore: imageID => {
        set(state => {
            const newImages = state.imagesArray.filter(
                image => image.id === imageID
            );
            const imagesMap = get().imagesMap;
            get().selectedImages.delete(imageID);
            imagesMap.delete(imageID);
            return {
                ...state,
                imagesArray: newImages,
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
                isQueried: true,
                isEmpty,
                imagesMap: newImagesMap
            }));
        });
    },
    addSelectedImage(imageSelected) {
        get().selectedImages.add(imageSelected.id);
    },
    removeSelectedImage(imageSelected) {
        get().selectedImages.delete(imageSelected.id);
    }
}));
