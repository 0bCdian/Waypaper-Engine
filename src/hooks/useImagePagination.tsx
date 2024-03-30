import {
    useState,
    useEffect,
    useCallback,
    useMemo,
    lazy,
    Suspense
} from 'react';
import { useFilteredImages } from './useFilteredImages';
import { imagesStore } from '../stores/images';
import Skeleton from '../components/Skeleton';
import { useHotkeys } from 'react-hotkeys-hook';
import { type rendererImage } from '../types/rendererTypes';
import { MENU_EVENTS } from '../../shared/constants';
import { useAppConfigStore } from '../stores/appConfig';
const ImageCard = lazy(async () => await import('../components/ImageCard'));
const { registerListener } = window.API_RENDERER;
export function useImagePagination() {
    const { appConfig } = useAppConfigStore();
    const [imagesPerPage, setImagesPerPage] = useState(appConfig.imagesPerPage);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const { skeletonsToShow, filters, selectedImages, setSelectedImages } =
        imagesStore();
    const { filteredImages, selectAllImages, clearSelection } =
        useFilteredImages();
    const lastImageIndex = useMemo(
        () => currentPage * imagesPerPage,
        [currentPage, imagesPerPage]
    );
    const firstImageIndex = useMemo(
        () => lastImageIndex - imagesPerPage,
        [lastImageIndex, imagesPerPage]
    );
    const totalImages = useMemo(() => {
        return filteredImages.length - 1;
    }, [filteredImages]);
    const lastImageIndexReversed = useMemo(
        () => totalImages - (currentPage - 1) * imagesPerPage,
        [currentPage, imagesPerPage, totalImages]
    );
    const firstImageIndexReversed = useMemo(
        () => lastImageIndexReversed - imagesPerPage,
        [lastImageIndexReversed, imagesPerPage]
    );
    const totalPages = useMemo(() => {
        const totalGalleryItems =
            filteredImages.length + (skeletonsToShow?.fileNames.length ?? 0);
        return Math.ceil(totalGalleryItems / imagesPerPage);
    }, [filteredImages, skeletonsToShow, imagesPerPage]);
    const SkeletonsArray = useMemo(() => {
        if (skeletonsToShow !== undefined) {
            return skeletonsToShow.fileNames.map((imageName, index) => {
                const imagePath = skeletonsToShow.imagePaths[index];
                return <Skeleton key={imagePath} imageName={imageName} />;
            });
        }
        return [];
    }, [skeletonsToShow]);
    const [imagesToShow, imagesInCurrentPage] = useMemo(() => {
        const imageCardJsxArray: JSX.Element[] = [];
        const imagesInCurrentPage: rendererImage[] = [];
        if (filters.order === 'desc') {
            for (let idx = firstImageIndex; idx < lastImageIndex; idx++) {
                const currentImage = filteredImages[idx];
                if (currentImage === undefined) break;
                imagesInCurrentPage.push(currentImage);
                const imageJsxElement = (
                    <Suspense key={currentImage.id}>
                        <ImageCard Image={currentImage} />
                    </Suspense>
                );
                imageCardJsxArray.push(imageJsxElement);
            }
        } else {
            for (
                let idx = lastImageIndexReversed;
                idx > firstImageIndexReversed;
                idx--
            ) {
                const currentImage = filteredImages[idx];
                if (currentImage === undefined) break;
                imagesInCurrentPage.push(currentImage);
                const imageJsxElement = (
                    <Suspense key={currentImage.id}>
                        <ImageCard Image={currentImage} />
                    </Suspense>
                );
                imageCardJsxArray.push(imageJsxElement);
            }
        }
        return [[...SkeletonsArray, ...imageCardJsxArray], imagesInCurrentPage];
    }, [filteredImages, filters, currentPage, totalPages]);
    const handlePageChange = useCallback((page: number) => {
        setCurrentPage(page);
    }, []);
    const selectImagesInCurrentPage = () => {
        const newSet = new Set(selectedImages);
        imagesInCurrentPage.forEach(image => {
            image.isSelected = !image.isSelected;
            if (image.isSelected) {
                newSet.add(image.id);
            } else {
                newSet.delete(image.id);
            }
        });
        setSelectedImages(newSet);
    };
    useHotkeys(
        'ctrl+a',
        () => {
            const newSet = new Set(selectedImages);
            imagesInCurrentPage.forEach(image => {
                image.isSelected = !image.isSelected;
                if (image.isSelected) {
                    newSet.add(image.id);
                } else {
                    newSet.delete(image.id);
                }
            });
            setSelectedImages(newSet);
        },
        [imagesInCurrentPage, selectedImages]
    );
    type registerListenerArgs = Parameters<typeof registerListener>[0];

    const eventsMap: registerListenerArgs[] = [
        {
            channel: MENU_EVENTS.clearSelection,
            listener: _ => {
                clearSelection();
            }
        },
        {
            channel: MENU_EVENTS.setImagesPerPage,
            listener: (_, imagesPerPage: number) => {
                setImagesPerPage(imagesPerPage);
            }
        },
        {
            channel: MENU_EVENTS.selectAllImagesInGallery,
            listener: _ => {
                selectAllImages();
            }
        },
        {
            channel: MENU_EVENTS.selectAllImagesInCurrentPage,
            listener: _ => {
                selectImagesInCurrentPage();
            }
        }
    ];
    useEffect(() => {
        eventsMap.forEach(eventToRegister => {
            registerListener(eventToRegister);
        });
    }, [eventsMap]);

    useEffect(() => {
        if (imagesToShow.length === 0) {
            setCurrentPage(totalPages);
        }
        if (filters.searchString === '') {
            setCurrentPage(1);
        }
    }, [imagesPerPage, totalPages, filters]);
    return {
        currentPage,
        totalPages,
        imagesToShow,
        handlePageChange,
        filteredImages,
        imagesInCurrentPage,
        selectedImages
    };
}
