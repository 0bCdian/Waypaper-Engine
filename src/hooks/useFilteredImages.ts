import { useDeferredValue, useMemo } from "react";
import { useImagesStore } from "../stores/images";
import { useShallow } from "zustand/react/shallow";
import { useHotkeys } from "react-hotkeys-hook";
import { parseGalleryFilterTokens, clientImageMatchesFilters } from "../utils/galleryFilterTokens";

/** The current page as sorted by the daemon, narrowed by the filters only the client can apply. */
export function useFilteredImages() {
  const { imagesArray, filters, setSelectedImages } = useImagesStore(
    useShallow((s) => ({
      imagesArray: s.imagesArray,
      filters: s.filters,
      setSelectedImages: s.setSelectedImages,
    })),
  );
  const deferredImages = useDeferredValue(imagesArray);

  const filteredImages = useMemo(() => {
    const parsed = parseGalleryFilterTokens(filters.filterTokens);
    return deferredImages.filter((image) =>
      clientImageMatchesFilters(
        image,
        parsed,
        filters.mediaType,
        filters.advancedFilters.resolution,
      ),
    );
  }, [deferredImages, filters.filterTokens, filters.mediaType, filters.advancedFilters.resolution]);

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

  useHotkeys(["mod+a", "ctrl+shift+a"], selectAllImages, { preventDefault: true });
  useHotkeys("escape", () => setSelectedImages(new Set<number>()));

  return { filteredImages };
}
