import ResponsivePagination from "react-responsive-pagination";
import "react-responsive-pagination/themes/minimal.css";
import "../custom.css";
import { useMemo, useRef, type RefObject } from "react";
import { useDroppable } from "@dnd-kit/react";
import PlaylistTrack from "./PlaylistTrack";
import PlaylistController from "./PlaylistController";
import FolderCard from "./FolderCard";
import AppDragDropProvider from "./AppDragDropProvider";
import { useImagePagination } from "../hooks/useImagePagination";
import { galleryHasActiveFilters } from "../utils/galleryFilterTokens";
import { LazyMotion, m, AnimatePresence, domAnimation } from "framer-motion";
import { useImagesStore } from "../stores/images";
import { useFoldersStore } from "../stores/foldersStore";
import { useIsNeo } from "../hooks/useIsNeo";
import { useContextMenuStore } from "../stores/contextMenuStore";
import { buildGalleryMenuItems } from "../utils/contextMenuItems";
import type { DropTargetData } from "../stores/dragStore";

function GalleryDropZone({
  children,
  onPointerDown,
}: {
  children: React.ReactNode;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
}) {
  const dropData = useMemo<DropTargetData>(() => ({ type: "gallery" }), []);
  const { ref } = useDroppable({
    id: "gallery-area",
    data: dropData,
    collisionPriority: -1,
  });

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-track-transparent scrollbar-thumb-base-300 scrollbar-thumb-rounded-sm p-4"
      style={{ scrollbarGutter: "stable" }}
    >
      {children}
    </div>
  );
}

type MarqueeBox = { x1: number; y1: number; x2: number; y2: number };

type PaginatedGalleryProps = {
  onMarqueePointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  gridRef: RefObject<HTMLDivElement | null>;
  marqueeBox: MarqueeBox | null;
};

function PaginatedGallery({ onMarqueePointerDown, gridRef, marqueeBox }: PaginatedGalleryProps) {
  const { imagesToShow, handlePageChange, currentPage, totalPages } = useImagePagination();
  const selectedImages = useImagesStore((s) => s.selectedImages);
  const folders = useFoldersStore((s) => s.folders);
  const currentFolderId = useFoldersStore((s) => s.currentFolderId);
  const filters = useImagesStore((s) => s.filters);
  const isNeo = useIsNeo();
  const ref = useRef<HTMLDivElement>(null);
  const openContextMenu = useContextMenuStore((s) => s.open);

  const handleContextMenu = (e: React.MouseEvent) => {
    const items = buildGalleryMenuItems(selectedImages.size);
    openContextMenu(e, items);
  };

  const hasActiveFilters = galleryHasActiveFilters(filters);

  const showFolders = !hasActiveFilters && currentPage === 1 && folders.length > 0;

  return (
    <LazyMotion features={domAnimation}>
      <AppDragDropProvider>
        <AnimatePresence>
          <m.div
            ref={ref}
            onHoverStart={() => {
              ref.current?.focus();
            }}
            tabIndex={-1}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="flex-1 min-h-0 flex flex-col transition focus:outline-hidden"
            onContextMenu={handleContextMenu}
          >
            <GalleryDropZone onPointerDown={onMarqueePointerDown}>
              <AnimatePresence mode="wait">
                <m.div
                  ref={gridRef}
                  key={`${currentFolderId ?? "root"}-${currentPage}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="m-auto w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(16vw,1fr))] gap-3 md:gap-3 lg:gap-3 xl:gap-4 2xl:gap-5 [&>:only-child]:max-w-[25vw] [&>:only-child]:justify-self-center"
                >
                  {showFolders &&
                    folders.map((folder) => (
                      <FolderCard key={`folder-${folder.id}`} folder={folder} />
                    ))}
                  {imagesToShow}
                </m.div>
              </AnimatePresence>
            </GalleryDropZone>

            {marqueeBox !== null && (
              <div className="pointer-events-none fixed inset-0 z-[200]" aria-hidden>
                <div
                  className="absolute border-2 border-primary/90 bg-primary/15"
                  style={{
                    left: Math.min(marqueeBox.x1, marqueeBox.x2),
                    top: Math.min(marqueeBox.y1, marqueeBox.y2),
                    width: Math.abs(marqueeBox.x2 - marqueeBox.x1),
                    height: Math.abs(marqueeBox.y2 - marqueeBox.y1),
                  }}
                />
              </div>
            )}

            {/* Pinned bottom: pagination + playlist track */}
            <div
              className={`shrink-0 flex w-full min-w-0 flex-col justify-between gap-4 px-2 lg:px-4 pt-3 pb-2 overflow-x-clip${isNeo ? " neo-bottom-dock" : ""}`}
            >
              <div className="self-center flex flex-col items-center gap-2">
                <div className="max-w-2xl min-w-1">
                  <ResponsivePagination
                    total={totalPages}
                    previousClassName="rounded_button_previous"
                    nextClassName="rounded_button_next"
                    current={currentPage}
                    onPageChange={(page: number) => {
                      handlePageChange(page);
                    }}
                  />
                </div>
                {totalPages > 1 && (
                  <span className="text-xs text-base-content/50">
                    Page {currentPage} of {totalPages}
                  </span>
                )}
              </div>
              <PlaylistController />
              <PlaylistTrack />
            </div>
          </m.div>
        </AnimatePresence>
      </AppDragDropProvider>
    </LazyMotion>
  );
}

export default PaginatedGallery;
