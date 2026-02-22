import { useDeferredValue } from "react";
import { useImagesStore } from "../stores/images";
import { useShallow } from "zustand/react/shallow";
import type { rendererImage } from "../types/rendererTypes";
import { useHotkeys } from "react-hotkeys-hook";

export function useFilteredImages() {
	const { imagesArray, filters, setSelectedImages } = useImagesStore(
		useShallow((s) => ({
			imagesArray: s.imagesArray,
			filters: s.filters,
			setSelectedImages: s.setSelectedImages,
		})),
	);
	const deferredImages = useDeferredValue(imagesArray);

	const sortedImages =
		filters.type === "id"
			? [...deferredImages]
			: [...deferredImages].sort((a, b) => b.name.localeCompare(a.name));

	const dontFilterByResolution =
		filters.advancedFilters.resolution.constraint === "all" ||
		filters.advancedFilters.resolution.width +
			filters.advancedFilters.resolution.height ===
			0;
	const dontFilterByFormat = filters.advancedFilters.formats.length === 10;

	const imagesfilteredByResolution: rendererImage[] = dontFilterByResolution
		? sortedImages
		: sortedImages.filter((image) => {
				const w = filters.advancedFilters.resolution.width;
				const h = filters.advancedFilters.resolution.height;
				switch (filters.advancedFilters.resolution.constraint) {
					case "exact":
						return (
							(w === 0 || image.width === w) &&
							(h === 0 || image.height === h)
						);
					case "lessThan":
						return (
							(w === 0 || image.width <= w) &&
							(h === 0 || image.height <= h)
						);
					case "moreThan":
						return (
							(w === 0 || image.width >= w) &&
							(h === 0 || image.height >= h)
						);
				}
				return undefined;
			});

	let filteredImages: rendererImage[];
	if (filters.advancedFilters.formats.length === 0) {
		filteredImages = [];
	} else {
		filteredImages = dontFilterByFormat
			? imagesfilteredByResolution
			: imagesfilteredByResolution.filter((image) => {
					return (filters.advancedFilters.formats as string[]).includes(
						image.format,
					);
				});
	}

	const selectAllImages = () => {
		const newSelected = new Set<number>();
		for (const image of filteredImages) {
			if (newSelected.has(image.id)) {
				newSelected.delete(image.id);
			} else {
				newSelected.add(image.id);
			}
		}
		setSelectedImages(newSelected);
	};

	const clearSelection = () => {
		setSelectedImages(new Set<number>());
	};

	useHotkeys("ctrl+shift+a", selectAllImages);
	useHotkeys("escape", clearSelection);

	return {
		filteredImages,
		selectAllImages,
		clearSelection,
	};
}
