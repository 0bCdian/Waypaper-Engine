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
      ? deferredImages
      : deferredImages.toSorted((a, b) => b.name.localeCompare(a.name));

  const parsed = useMemo(
    () => parseGalleryFilterTokens(filters.filterTokens),
    [filters.filterTokens],
  );

  const filteredImages = sortedImages.filter((image) =>
    clientImageMatchesFilters(image, parsed, filters.mediaType, filters.advancedFilters.resolution),
  );

  const selectAllImages = () => {
    const current = useImagesStore.getState().selectedImages;
    const allSelected =
      filteredImages.length > 0 && filteredImages.every((img) => current.has(img.id));
    if (allSelected) {
      const next = new Set(current);
      for (const img of filteredImages) next.delete(img.id);
      setSelectedImages(next);
    } else {
      setSelectedImages(new Set(filteredImages.map((img) => img.id)));
    }
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
