import type { ReactNode } from "react";
import { useEffect, lazy, Suspense, useRef } from "react";
import { useFilteredImages } from "./useFilteredImages";
import { useImagesStore } from "../stores/images";
import { useShallow } from "zustand/react/shallow";
import { useHotkeys } from "react-hotkeys-hook";
import type { rendererImage } from "../types/rendererTypes";
import { useSettingsStore } from "../stores/settingsStore";
import {
  parseGalleryFilterTokens,
  hasClientSideGalleryFilters,
} from "../utils/galleryFilterTokens";

const ImageCard = lazy(async () => await import("../components/ImageCard"));

export function useImagePagination() {
  const config = useSettingsStore((s) => s.config);
  const { filters, selectedImages, setSelectedImages, pagination, perPage, currentPage } =
    useImagesStore(
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

  const prevTokensSerialized = useRef<string | null>(null);

  // Sync perPage from config on first load
  useEffect(() => {
    const configPerPage = config?.app?.images_per_page ?? 50;
    if (configPerPage !== perPage) {
      useImagesStore.setState({ perPage: configPerPage });
    }
  }, [config?.app?.images_per_page, perPage]);

  const parsed = parseGalleryFilterTokens(filters.filterTokens);
  const hasClientSideFilter = hasClientSideGalleryFilters(
    parsed,
    filters.mediaType,
    filters.advancedFilters.resolution,
  );

  const totalPages = hasClientSideFilter
    ? Math.max(1, Math.ceil(filteredImages.length / perPage))
    : pagination?.total_pages
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
    useImagesStore.getState().fetchPage(page);
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

  useEffect(() => {
    const serialized = JSON.stringify(filters.filterTokens);
    if (
      prevTokensSerialized.current !== null &&
      serialized === "[]" &&
      prevTokensSerialized.current !== "[]"
    ) {
      useImagesStore.getState().fetchPage(1);
    }
    prevTokensSerialized.current = serialized;
  }, [filters.filterTokens]);

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
