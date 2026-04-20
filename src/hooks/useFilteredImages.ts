import { useDeferredValue, useMemo } from "react";
import { useImagesStore } from "../stores/images";
import { useShallow } from "zustand/react/shallow";
import { useHotkeys } from "react-hotkeys-hook";
import { parseGalleryFilterTokens, clientImageMatchesFilters } from "../utils/galleryFilterTokens";

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

  const parsed = useMemo(
    () => parseGalleryFilterTokens(filters.filterTokens),
    [filters.filterTokens],
  );

  const filteredImages = sortedImages.filter((image) =>
    clientImageMatchesFilters(image, parsed, filters.mediaType, filters.advancedFilters.resolution),
  );

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
