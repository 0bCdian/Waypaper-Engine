import { useEffect, useRef } from "react";
import { useFilteredImages } from "./useFilteredImages";
import { useImagesStore } from "../stores/images";
import { useShallow } from "zustand/react/shallow";
import { useSettingsStore } from "../stores/settingsStore";
import {
  parseGalleryFilterTokens,
  hasClientSideGalleryFilters,
} from "../utils/galleryFilterTokens";
import ImageCard from "../components/ImageCard";

export function useImagePagination() {
  const configPerPage = useSettingsStore((s) => s.config?.app?.images_per_page ?? 50);
  const { filters, pagination, perPage, currentPage } = useImagesStore(
    useShallow((s) => ({
      filters: s.filters,
      pagination: s.pagination,
      perPage: s.perPage,
      currentPage: s.currentPage,
    })),
  );
  const { filteredImages } = useFilteredImages();

  const prevTokensSerialized = useRef<string | null>(null);

  useEffect(() => {
    if (configPerPage !== perPage) {
      useImagesStore.setState({ perPage: configPerPage });
    }
  }, [configPerPage, perPage]);

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

  const imagesToShow = filteredImages.map((image) => <ImageCard key={image.id} Image={image} />);

  const handlePageChange = (page: number) => {
    useImagesStore.getState().fetchPage(page);
  };

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

  return { currentPage, totalPages, imagesToShow, handlePageChange };
}
