import { useMemo, useRef, type RefObject } from "react";
import { useDroppable } from "@dnd-kit/react";
import BottomDock from "./BottomDock";
import FolderCard from "./FolderCard";
import AppDragDropProvider from "./AppDragDropProvider";
import { useImagePagination } from "../hooks/useImagePagination";
import { galleryHasActiveFilters } from "../utils/galleryFilterTokens";
import { LazyMotion, m, AnimatePresence, domAnimation } from "framer-motion";
import { useImagesStore } from "../stores/images";
import { useFoldersStore } from "../stores/foldersStore";
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
      className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-track-transparent scrollbar-thumb-base-300 scrollbar-thumb-rounded-sm p-[length:var(--wp-gallery-scroll-padding)]"
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
                  className="m-auto w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-[repeat(auto-fit,minmax(min(var(--wp-gallery-min-col),100%),1fr))] gap-3 xl:gap-4 2xl:gap-5 [@media(max-height:1080px)]:gap-2 [@media(max-height:1080px)]:xl:gap-3 [@media(max-height:1080px)]:2xl:gap-4 [&>:only-child]:max-w-[min(25vw,400px)] [&>:only-child]:justify-self-center [@media(max-height:1080px)]:[&>:only-child]:max-w-[min(25vw,320px)]"
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
            <BottomDock
              currentPage={currentPage}
              totalPages={totalPages}
              handlePageChange={handlePageChange}
            />
          </m.div>
        </AnimatePresence>
      </AppDragDropProvider>
    </LazyMotion>
  );
}

export default PaginatedGallery;
