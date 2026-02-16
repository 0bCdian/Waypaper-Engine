import { useCallback, useEffect, useMemo, useState } from "react";
import { imagesStore } from "../stores/images";
import { type rendererImage } from "../types/rendererTypes";
import { useHotkeys } from "react-hotkeys-hook";

export function useFilteredImages() {
	const { imagesArray, filters, setSelectedImages } = imagesStore();
	const [filteredImages, setFilteredImages] =
		useState<rendererImage[]>(imagesArray);

	const selectAllImages = useCallback(() => {
		const newSelected = new Set<number>();
		for (const image of filteredImages) {
			if (newSelected.has(image.id)) {
				newSelected.delete(image.id);
			} else {
				newSelected.add(image.id);
			}
		}
		setSelectedImages(newSelected);
	}, [filteredImages]);

	const clearSelection = useCallback(() => {
		setSelectedImages(new Set<number>());
	}, []);

	useHotkeys("ctrl+shift+a", selectAllImages);
	useHotkeys("escape", clearSelection);

	const sortedImages = useMemo(() => {
		if (filters.type === "id") return [...imagesArray];
		const shallowCopy = [...imagesArray];
		shallowCopy.sort((a, b) => b.name.localeCompare(a.name));
		return shallowCopy;
	}, [imagesArray, filters]);

	useEffect(() => {
		const dontFilterByResolution =
			filters.advancedFilters.resolution.constraint === "all" ||
			filters.advancedFilters.resolution.width +
				filters.advancedFilters.resolution.height ===
				0;
		const dontFilterByFormat = filters.advancedFilters.formats.length === 10;
		const dontFilterByName = filters.searchString === "";

		const imagesfilteredByResolution: rendererImage[] = dontFilterByResolution
			? sortedImages
			: sortedImages.filter((image) => {
					const widthToFilter = filters.advancedFilters.resolution.width;
					const heightToFilter = filters.advancedFilters.resolution.height;
					switch (filters.advancedFilters.resolution.constraint) {
						case "exact":
							return (
								image.width === widthToFilter &&
								image.height === heightToFilter
							);
						case "lessThan":
							return (
								image.width <= widthToFilter &&
								image.height <= heightToFilter
							);
						case "moreThan":
							return (
								image.width >= widthToFilter &&
								image.height >= heightToFilter
							);
					}
					return undefined;
				});

		let imagesFilteredByFormat: rendererImage[];
		if (filters.advancedFilters.formats.length === 0) {
			imagesFilteredByFormat = [];
		} else {
			imagesFilteredByFormat = dontFilterByFormat
				? imagesfilteredByResolution
				: imagesfilteredByResolution.filter((image) => {
						return filters.advancedFilters.formats.includes(
							image.format as any,
						);
					});
		}

		const imagesFilteredByName: rendererImage[] = dontFilterByName
			? imagesFilteredByFormat
			: imagesFilteredByFormat.filter((image) => {
					return image.name
						.toLocaleLowerCase()
						.includes(filters.searchString.toLocaleLowerCase());
				});

		setFilteredImages(imagesFilteredByName);
	}, [sortedImages, filters]);

	return {
		filteredImages,
		selectAllImages,
		clearSelection,
	};
}
