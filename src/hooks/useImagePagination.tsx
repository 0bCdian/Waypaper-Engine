import type { ReactNode } from "react";
import { useEffect, lazy, Suspense } from "react";
import { useFilteredImages } from "./useFilteredImages";
import { useImagesStore } from "../stores/images";
import { useShallow } from "zustand/react/shallow";
import { useHotkeys } from "react-hotkeys-hook";
import type { rendererImage } from "../types/rendererTypes";
import { useSettingsStore } from "../stores/settingsStore";
import type { ImageQueryParams } from "../../electron/daemon-go-types";

const ImageCard = lazy(async () => await import("../components/ImageCard"));

export function useImagePagination() {
	const config = useSettingsStore((s) => s.config);
	const {
		filters,
		selectedImages,
		setSelectedImages,
		pagination,
		perPage,
		currentPage,
	} = useImagesStore(
		useShallow((s) => ({
			filters: s.filters,
			selectedImages: s.selectedImages,
			setSelectedImages: s.setSelectedImages,
			pagination: s.pagination,
			perPage: s.perPage,
			currentPage: s.currentPage,
		})),
	);
	const { filteredImages } = useFilteredImages();

	// Sync perPage from config on first load
	useEffect(() => {
		const configPerPage = config?.app?.images_per_page ?? 50;
		if (configPerPage !== perPage) {
			useImagesStore.setState({ perPage: configPerPage });
		}
	}, [config?.app?.images_per_page, perPage]);

	const totalPages = pagination?.total_pages
		? pagination.total_pages
		: Math.max(1, Math.ceil(filteredImages.length / perPage));

	const imageCardJsxArray: ReactNode[] = [];
	const imagesInCurrentPage: rendererImage[] = [];

	for (let idx = 0; idx < filteredImages.length; idx++) {
		const currentImage = filteredImages[idx];
		if (currentImage === undefined) break;
		imagesInCurrentPage.push(currentImage);
		imageCardJsxArray.push(
			<Suspense key={currentImage.id || `image-${idx}`}>
				<ImageCard Image={currentImage} />
			</Suspense>,
		);
	}

	const imagesToShow = imageCardJsxArray;

	const handlePageChange = (page: number) => {
		const { filters: currentFilters } = useImagesStore.getState();
		const queryParams: Partial<ImageQueryParams> = {
			sort_by: currentFilters.type === "name" ? "name" : "imported_at",
			sort_order: currentFilters.order,
			search: currentFilters.searchString || undefined,
		};
		useImagesStore.getState().fetchPage(page, queryParams);
	};

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
		(e) => {
			e.preventDefault();
			selectImagesInCurrentPage();
		},
		{ preventDefault: true },
		[imagesInCurrentPage, selectedImages],
	);

	// Reset to page 1 when search is cleared
	useEffect(() => {
		if (filters.searchString === "") {
			const { filters: currentFilters } = useImagesStore.getState();
			useImagesStore.getState().fetchPage(1, {
				sort_by: currentFilters.type === "name" ? "name" : "imported_at",
				sort_order: currentFilters.order,
			});
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
