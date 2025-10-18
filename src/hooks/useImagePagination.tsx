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
import {
	type DaemonSetImagesPerPagePayload,
	type DaemonDeleteImageFromGalleryPayload,
} from "../../shared/types/daemonEvents";
const ImageCard = lazy(async () => await import("../components/ImageCard"));
const { goDaemon } = window.API_RENDERER;
export function useImagePagination() {
	const { config } = useUnifiedConfigStore();
	const { removeImagesFromPlaylist, addImagesToPlaylist } = playlistStore();
	const [imagesPerPage, setImagesPerPage] = useState(
		config?.app?.images_per_page ?? 20,
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
		const result: [JSX.Element[], rendererImage[]] = [
			imageCardJsxArray,
			imagesInCurrentPage,
		];
		return result;
	}, [filteredImages, filters, currentPage, totalPages]);
	const handlePageChange = useCallback((page: number) => {
		setCurrentPage(page);
	}, []);
	const selectImagesInCurrentPage = () => {
		const newSet = new Set(selectedImages);
		imagesInCurrentPage.forEach((image) => {
			image.selection.isSelected = !image.selection.isSelected;
			if (image.selection.isSelected) {
				newSet.add(image.id);
			} else {
				newSet.delete(image.id);
			}
		});
		setSelectedImages(newSet);
	};
	const clearSelectedImagesInCurrentPage = () => {
		const newSet = new Set(selectedImages);
		imagesInCurrentPage.forEach((image) => {
			image.selection.isSelected = false;
			newSet.delete(image.id);
		});
		setSelectedImages(newSet);
	};
	useHotkeys("ctrl+a", () => {
		const newSet = new Set(selectedImages);
		imagesInCurrentPage.forEach((image) => {
			image.selection.isSelected = !image.selection.isSelected;
			if (image.selection.isSelected) {
				newSet.add(image.id);
			} else {
				newSet.delete(image.id);
			}
		});
		setSelectedImages(newSet);
	}, [imagesInCurrentPage, selectedImages]);
	useEffect(() => {
		// Listen for menu events via Go daemon
		goDaemon.on("clear_selection", () => {
			clearSelection();
		});
		goDaemon.on("set_images_per_page", (...args: unknown[]) => {
			const payload = args[0] as DaemonSetImagesPerPagePayload;
			setImagesPerPage(payload.imagesPerPage);
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
		goDaemon.on("delete_image_from_gallery", (...args: unknown[]) => {
			const payload = args[0] as DaemonDeleteImageFromGalleryPayload;
			// Convert DaemonDeleteImageFromGalleryPayload to rendererImage for compatibility
			const imageToRemove: rendererImage = {
				id: payload.id,
				name: payload.name,
				path: payload.path,
				mediaType: "image",
				dimensions: { width: 0, height: 0 },
				metadata: {
					format: "",
					fileSize: 0,
					checksum: "",
					tags: [],
					properties: {},
				},
				selection: {
					isChecked: false,
					isSelected: false,
					selectedAt: undefined,
					selectedPlaylists: [],
				},
				importInfo: {
					importedAt: "",
					sourcePath: payload.path,
					importer: "unknown",
				},
				thumbnails: {
					"720p": "",
					"1080p": "",
					"1440p": "",
					"4k": "",
					fallback: "",
				},
				time: null,
			};
			removeImagesFromStore([imageToRemove]);
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
		selectedImages,
	};
}
