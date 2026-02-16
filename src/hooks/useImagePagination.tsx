import {
	useState,
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
import { playlistStore } from "../stores/playlist";

const ImageCard = lazy(async () => await import("../components/ImageCard"));

export function useImagePagination() {
	const { config } = useUnifiedConfigStore();
	const { removeImagesFromPlaylist, addImagesToPlaylist } = playlistStore();
	const [imagesPerPage, setImagesPerPage] = useState(
		config?.app?.images_per_page ?? 50,
	);
	const [currentPage, setCurrentPage] = useState<number>(1);
	const {
		filters,
		selectedImages,
		setSelectedImages,
		deleteSelectedImages,
		getSelectedImages,
		removeImagesFromStore,
	} = imagesStore();
	const { filteredImages, selectAllImages, clearSelection } =
		useFilteredImages();

	const lastImageIndex = useMemo(
		() => currentPage * imagesPerPage,
		[currentPage, imagesPerPage],
	);
	const firstImageIndex = useMemo(
		() => lastImageIndex - imagesPerPage,
		[lastImageIndex, imagesPerPage],
	);
	const totalImages = useMemo(() => {
		return filteredImages.length - 1;
	}, [filteredImages]);
	const lastImageIndexReversed = useMemo(
		() => totalImages - (currentPage - 1) * imagesPerPage,
		[currentPage, imagesPerPage, totalImages],
	);
	const firstImageIndexReversed = useMemo(
		() => lastImageIndexReversed - imagesPerPage,
		[lastImageIndexReversed, imagesPerPage],
	);
	const totalPages = useMemo(() => {
		return Math.ceil(filteredImages.length / imagesPerPage);
	}, [filteredImages, imagesPerPage]);

	const [imagesToShow, imagesInCurrentPage] = useMemo((): [
		JSX.Element[],
		rendererImage[],
	] => {
		const imageCardJsxArray: JSX.Element[] = [];
		const imagesInCurrentPage: rendererImage[] = [];
		if (filters.order === "desc") {
			for (let idx = firstImageIndex; idx < lastImageIndex; idx++) {
				const currentImage = filteredImages[idx];
				if (currentImage === undefined) break;
				imagesInCurrentPage.push(currentImage);
				imageCardJsxArray.push(
					<Suspense key={currentImage.id || `image-${idx}`}>
						<ImageCard Image={currentImage} />
					</Suspense>,
				);
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
				imageCardJsxArray.push(
					<Suspense key={currentImage.id || `image-${idx}`}>
						<ImageCard Image={currentImage} />
					</Suspense>,
				);
			}
		}
		return [imageCardJsxArray, imagesInCurrentPage];
	}, [filteredImages, filters, currentPage, totalPages]);

	const handlePageChange = useCallback((page: number) => {
		setCurrentPage(page);
	}, []);

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

	const clearSelectedImagesInCurrentPage = () => {
		const newSet = new Set(selectedImages);
		imagesInCurrentPage.forEach((image) => {
			newSet.delete(image.id);
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
		selectedImages,
	};
}
