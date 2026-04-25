import ResponsivePagination from "react-responsive-pagination";
import "react-responsive-pagination/themes/minimal.css";
import "../custom.css";
import { useCallback, useMemo, useRef, useState } from "react";
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

function GalleryDropZone({ children }: { children: React.ReactNode }) {
  const dropData = useMemo<DropTargetData>(() => ({ type: "gallery" }), []);
  const { ref } = useDroppable({
    id: "gallery-area",
    data: dropData,
    collisionPriority: -1,
  });

  return (
    <div
      ref={ref}
      className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-track-transparent scrollbar-thumb-base-300 scrollbar-thumb-rounded-sm p-4"
      style={{ scrollbarGutter: "stable" }}
    >
      {children}
    </div>
  );
}

function rectsIntersect(a: DOMRect, b: { left: number; top: number; right: number; bottom: number }) {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

function PaginatedGallery() {
  const { imagesToShow, handlePageChange, currentPage, totalPages, setSelectedImages } =
    useImagePagination();
  const selectedImages = useImagesStore((s) => s.selectedImages);
  const folders = useFoldersStore((s) => s.folders);
  const currentFolderId = useFoldersStore((s) => s.currentFolderId);
  const filters = useImagesStore((s) => s.filters);
  const isNeo = useIsNeo();
  const ref = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [marqueeBox, setMarqueeBox] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  const marqueeLiveRef = useRef<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const shiftDuringMarqueeRef = useRef(false);
  const openContextMenu = useContextMenuStore((s) => s.open);

  const handleContextMenu = (e: React.MouseEvent) => {
    const items = buildGalleryMenuItems(selectedImages.size);
    openContextMenu(e, items);
  };

  const hasActiveFilters = galleryHasActiveFilters(filters);

  const showFolders = !hasActiveFilters && currentPage === 1 && folders.length > 0;

  const onGridPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      const t = e.target as HTMLElement;
      if (t.closest("[data-gallery-image-root]") || t.closest("[data-folder-card]")) return;

      e.preventDefault();
      shiftDuringMarqueeRef.current = e.shiftKey;
      const { clientX, clientY } = e;
      const start = { x1: clientX, y1: clientY, x2: clientX, y2: clientY };
      marqueeLiveRef.current = start;
      setMarqueeBox(start);
      document.documentElement.style.userSelect = "none";

      const onMove = (ev: PointerEvent) => {
        const cur = marqueeLiveRef.current;
        if (!cur) return;
        const next = { ...cur, x2: ev.clientX, y2: ev.clientY };
        marqueeLiveRef.current = next;
        setMarqueeBox(next);
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        document.documentElement.style.userSelect = "";

        const prev = marqueeLiveRef.current;
        marqueeLiveRef.current = null;
        setMarqueeBox(null);

        if (!prev || !gridRef.current) return;
        const left = Math.min(prev.x1, prev.x2);
        const top = Math.min(prev.y1, prev.y2);
        const right = Math.max(prev.x1, prev.x2);
        const bottom = Math.max(prev.y1, prev.y2);
        const w = right - left;
        const h = bottom - top;
        if (w < 4 && h < 4) return;

        const selRect = { left, top, right, bottom };
        const roots = gridRef.current.querySelectorAll<HTMLElement>("[data-gallery-image-root]");
        const hitIds = new Set<number>();
        for (const root of roots) {
          const r = root.getBoundingClientRect();
          if (rectsIntersect(r, selRect)) {
            const id = Number(root.dataset.imageId);
            if (Number.isFinite(id)) hitIds.add(id);
          }
        }

        const prevSel = useImagesStore.getState().selectedImages;
        const nextSel =
          shiftDuringMarqueeRef.current && prevSel.size > 0
            ? new Set([...prevSel, ...hitIds])
            : hitIds;
        setSelectedImages(nextSel);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [setSelectedImages],
  );

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
            <GalleryDropZone>
              <AnimatePresence mode="wait">
                <m.div
                  ref={gridRef}
                  key={`${currentFolderId ?? "root"}-${currentPage}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  onPointerDown={onGridPointerDown}
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
