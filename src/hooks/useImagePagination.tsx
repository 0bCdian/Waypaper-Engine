import {
    useState,
    useEffect,
    useCallback,
    useMemo,
    lazy,
    Suspense
} from "react";
import { useFilteredImages } from "./useFilteredImages";
import { imagesStore } from "../stores/images";
import Skeleton from "../components/Skeleton";
import { useHotkeys } from "react-hotkeys-hook";
import { type rendererImage } from "../types/rendererTypes";
import { MENU_EVENTS } from "../../shared/constants";
import { useAppConfigStore } from "../stores/appConfig";
import { playlistStore } from "../stores/playlist";
const ImageCard = lazy(async () => await import("../components/ImageCard"));
const { goDaemon } = window.API_RENDERER;
export function useImagePagination() {
    const { appConfig } = useAppConfigStore();
    const { removeImagesFromPlaylist, addImagesToPlaylist } = playlistStore();
    const [imagesPerPage, setImagesPerPage] = useState(appConfig.imagesPerPage);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const {
        skeletonsToShow,
        filters,
        selectedImages,
        setSelectedImages,
        deleteSelectedImages,
        getSelectedImages,
        removeImagesFromStore
    } = imagesStore();
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
        console.log("🟡 useImagePagination: SkeletonsArray useMemo called, skeletonsToShow:", skeletonsToShow);
        if (skeletonsToShow !== undefined) {
            const skeletons = skeletonsToShow.fileNames.map((imageName, index) => {
                const imagePath = skeletonsToShow.imagePaths[index];
                return <Skeleton key={imagePath} imageName={imageName} />;
            });
            console.log("🟡 useImagePagination: Created", skeletons.length, "skeletons");
            return skeletons;
        }
        console.log("🟡 useImagePagination: No skeletons to show");
        return [];
    }, [skeletonsToShow]);
    const [imagesToShow, imagesInCurrentPage] = useMemo(() => {
        const imageCardJsxArray: JSX.Element[] = [];
        const imagesInCurrentPage: rendererImage[] = [];
        if (filters.order === "desc") {
            for (let idx = firstImageIndex; idx < lastImageIndex; idx++) {
                const currentImage = filteredImages[idx];
                if (currentImage === undefined) break;
                imagesInCurrentPage.push(currentImage);
                const imageJsxElement = (
                    <Suspense key={currentImage.id || `image-${idx}`}>
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
                    <Suspense key={currentImage.id || `image-${idx}`}>
                        <ImageCard Image={currentImage} />
                    </Suspense>
                );
                imageCardJsxArray.push(imageJsxElement);
            }
        }
        const result = [[...SkeletonsArray, ...imageCardJsxArray], imagesInCurrentPage];
        console.log("🟡 useImagePagination: Created imagesToShow with", result[0].length, "total items (", SkeletonsArray.length, "skeletons +", imageCardJsxArray.length, "images)");
        return result;
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
    const clearSelectedImagesInCurrentPage = () => {
        const newSet = new Set(selectedImages);
        imagesInCurrentPage.forEach(image => {
            image.isSelected = false;
            newSet.delete(image.id);
        });
        setSelectedImages(newSet);
    };
    useHotkeys(
        "ctrl+a",
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
    useEffect(() => {
        // Listen for menu events via Go daemon
        goDaemon.on("clear_selection", () => {
            clearSelection();
        });
        goDaemon.on("set_images_per_page", (imagesPerPage: number) => {
            setImagesPerPage(imagesPerPage);
        });
        goDaemon.on("select_all_images_in_gallery", () => {
            selectAllImages();
        });
        goDaemon.on("select_all_images_in_current_page", () => {
            selectImagesInCurrentPage();
        });
        goDaemon.on("clear_selection_on_current_page", () => {
            clearSelectedImagesInCurrentPage();
        });
        goDaemon.on("remove_selected_images_from_playlist", () => {
            removeImagesFromPlaylist(selectedImages);
        });
        goDaemon.on("delete_all_selected_images", () => {
            deleteSelectedImages();
        });
        goDaemon.on("add_selected_images_to_playlist", () => {
            addImagesToPlaylist(getSelectedImages());
        });
        goDaemon.on("delete_image_from_gallery", (image: rendererImage) => {
            removeImagesFromStore([image]);
        });
    }, [selectedImages]);

    useEffect(() => {
        if (imagesToShow.length === 0) {
            setCurrentPage(totalPages);
        }
        if (filters.searchString === "") {
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
