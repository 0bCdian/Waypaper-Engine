import {
	type ReactNode,
	useEffect,
	useCallback,
	useMemo,
	lazy,
	Suspense,
} from "react";
import { useFilteredImages } from "./useFilteredImages";
import { imagesStore } from "../stores/images";
import { useHotkeys } from "react-hotkeys-hook";
import { type rendererImage } from "../types/rendererTypes";
import { useUnifiedConfigStore } from "../stores/unifiedConfig";

const ImageCard = lazy(async () => await import("../components/ImageCard"));

export function useImagePagination() {
	const { config } = useUnifiedConfigStore();
	const {
		filters,
		selectedImages,
		setSelectedImages,
		pagination,
		perPage,
		currentPage,
	} = imagesStore();
	const { filteredImages } = useFilteredImages();

	// Sync perPage from config on first load
	useEffect(() => {
		const configPerPage = config?.app?.images_per_page ?? 50;
		if (configPerPage !== perPage) {
			imagesStore.setState({ perPage: configPerPage });
		}
	}, [config?.app?.images_per_page, perPage]);

	// Use server-side total when available, fall back to client-side count
	const totalPages = useMemo(() => {
		if (pagination?.total_pages) {
			return pagination.total_pages;
		}
		return Math.max(1, Math.ceil(filteredImages.length / perPage));
	}, [pagination, filteredImages.length, perPage]);

	// Build the image cards from the current page data (already fetched from server)
	const [imagesToShow, imagesInCurrentPage] = useMemo((): [
		ReactNode[],
		rendererImage[],
	] => {
		const imageCardJsxArray: ReactNode[] = [];
		const currentPageImages: rendererImage[] = [];

		for (let idx = 0; idx < filteredImages.length; idx++) {
			const currentImage = filteredImages[idx];
			if (currentImage === undefined) break;
			currentPageImages.push(currentImage);
			imageCardJsxArray.push(
				<Suspense key={currentImage.id || `image-${idx}`}>
					<ImageCard Image={currentImage} />
				</Suspense>,
			);
		}

		return [imageCardJsxArray, currentPageImages];
	}, [filteredImages]);

	const handlePageChange = useCallback(
		(page: number) => {
			imagesStore.getState().fetchPage(page);
		},
		[],
	);

	const selectImagesInCurrentPage = () => {
		const newSet = new Set(selectedImages);
		imagesInCurrentPage.forEach((image) => {
			if (newSet.has(image.id)) {
				newSet.delete(image.id);
			} else {
				newSet.add(image.id);
			}
		});
		setSelectedImages(newSet);
	};

	useHotkeys(
		"ctrl+a",
		() => {
			selectImagesInCurrentPage();
		},
		[imagesInCurrentPage, selectedImages],
	);

	// Reset to page 1 when search is cleared
	useEffect(() => {
		if (filters.searchString === "") {
			imagesStore.getState().fetchPage(1);
		}
	}, [filters.searchString]);

	return {
		currentPage,
		totalPages,
		imagesToShow,
		handlePageChange,
		filteredImages,
		imagesInCurrentPage,
		selectedImages,
	};
}
