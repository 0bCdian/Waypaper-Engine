import { useCallback, useEffect, useRef, useState } from "react";
import { daemonClient } from "@/client";
import { useNavigate } from "react-router-dom";
import { useGalleryMarquee } from "../hooks/useGalleryMarquee";
import { useLoadImages } from "../hooks/useLoadImages";
import { useImagesStore } from "../stores/images";
import { useFoldersStore } from "../stores/foldersStore";
import { galleryHasActiveFilters } from "../utils/galleryFilterTokens";
import { collectDroppedPaths, importMediaDrop, downloadAndImportUrls } from "../utils/galleryDrop";
import { useDropZone } from "../hooks/useDropZone";
import { UrlImportWarningModal } from "./UrlImportWarningModal";
import AddImagesCard from "./AddImagesCard";
import PaginatedGallery from "./PaginatedGallery";
import Filters from "./Filters";
import Breadcrumbs from "./Breadcrumbs";
import Modal, { type ModalHandle } from "./Modal";
import { paperGridBackgroundStyle } from "../utils/paperGridBackground";

function Gallery() {
  const isEmpty = useImagesStore((state) => state.isEmpty);
  const isQueried = useImagesStore((state) => state.isQueried);
  const filters = useImagesStore((s) => s.filters);
  const currentFolderId = useFoldersStore((s) => s.currentFolderId);
  const navigate = useNavigate();
  useLoadImages();

  useEffect(() => {
    useFoldersStore.getState().fetchFolders(currentFolderId);
  }, [currentFolderId]);

  useEffect(() => {
    const dispose = daemonClient.on("gallery_changed", (data: unknown) => {
      const payload = data as { domain?: string };
      if (payload?.domain !== "folders") return;
      const fid = useFoldersStore.getState().currentFolderId;
      useFoldersStore.getState().fetchFolders(fid);
    });
    return dispose;
  }, []);

  const folders = useFoldersStore((s) => s.folders);
  const hasActiveFilters = galleryHasActiveFilters(filters);
  const { onMarqueePointerDown, gridRef, marqueeBox } = useGalleryMarquee();

  const [pendingUrls, setPendingUrls] = useState<string[]>([]);
  // Holds a dropped File that looks like a Shadertoy JSON, pending user confirmation.
  const [pendingShadertoyFile, setPendingShadertoyFile] = useState<File | null>(null);
  const shadertoyModalRef = useRef<ModalHandle>(null);

  useEffect(() => {
    if (pendingShadertoyFile) shadertoyModalRef.current?.showModal();
  }, [pendingShadertoyFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    const { mediaPaths, manifestPaths, shadertoyPaths, otherPaths, urls } = collectDroppedPaths(e);

    if (mediaPaths.length > 0 || manifestPaths.length > 0 || otherPaths.length > 0) {
      void importMediaDrop(mediaPaths, manifestPaths, otherPaths);
      return;
    }

    if (shadertoyPaths.length > 0) {
      // Find the first .json File object from the drop event
      const files = e.dataTransfer.files;
      for (let i = 0; i < files.length; i++) {
        if (files[i].name.toLowerCase().endsWith(".json")) {
          setPendingShadertoyFile(files[i]);
          return;
        }
      }
      return;
    }

    if (urls.length > 0) {
      const skipWarning = localStorage.getItem("skipUrlImportWarning") === "true";
      if (skipWarning) {
        void downloadAndImportUrls(urls);
      } else {
        setPendingUrls(urls);
      }
    }
  }, []);

  const { isDragging, handlers } = useDropZone(handleDrop);

  const handleUrlImportConfirm = useCallback(
    (dontShowAgain: boolean) => {
      if (dontShowAgain) localStorage.setItem("skipUrlImportWarning", "true");
      const urls = pendingUrls;
      setPendingUrls([]);
      void downloadAndImportUrls(urls);
    },
    [pendingUrls],
  );

  const handleOpenInShaderStudio = useCallback(() => {
    const file = pendingShadertoyFile;
    setPendingShadertoyFile(null);
    shadertoyModalRef.current?.close();
    if (!file) return;
    void file.text().then((text) => {
      navigate("/shader-studio", { state: { shadertoyJsonText: text } });
    });
  }, [pendingShadertoyFile, navigate]);

  const handleCancelShadertoy = useCallback(() => {
    setPendingShadertoyFile(null);
    shadertoyModalRef.current?.close();
  }, []);

  const content =
    isEmpty &&
    isQueried &&
    !hasActiveFilters &&
    currentFolderId === null &&
    folders.length === 0 ? (
      <div className="h-full flex flex-col items-center justify-center gap-6 p-4">
        <div className="max-w-lg space-y-2 text-center">
          <p className="text-lg font-semibold text-base-content">No images yet</p>
          <p className="text-sm text-base-content/80">
            Use the actions below, or drag files or an image URL onto the window to import.
          </p>
        </div>
        <AddImagesCard />
      </div>
    ) : (
      <div className="h-full flex flex-col overflow-hidden">
        <Breadcrumbs />
        <div className="shrink-0" onPointerDown={onMarqueePointerDown}>
          <Filters />
        </div>
        <PaginatedGallery
          onMarqueePointerDown={onMarqueePointerDown}
          gridRef={gridRef}
          marqueeBox={marqueeBox}
        />
      </div>
    );

  return (
    <div className="h-full flex flex-col overflow-hidden relative" {...handlers}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 bg-base-100"
        style={paperGridBackgroundStyle()}
      />
      <div className="relative z-[1] flex flex-1 min-h-0 flex-col overflow-hidden">
        {isDragging && (
          <div className="absolute inset-0 z-[200] flex items-center justify-center bg-base-300/80 backdrop-blur-sm pointer-events-none">
            <div className="flex flex-col items-center gap-4 p-8 rounded-xl border-2 border-dashed border-primary">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-16 w-16 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 16v-8m0 0l-3 3m3-3l3 3M3 16.5V18a2.25 2.25 0 002.25 2.25h13.5A2.25 2.25 0 0021 18v-1.5m-18 0V7.875c0-.621.504-1.125 1.125-1.125h3.172c.53 0 1.04.21 1.414.586l1.578 1.578c.375.375.884.586 1.414.586h6.172c.621 0 1.125.504 1.125 1.125V16.5"
                />
              </svg>
              <span className="text-2xl font-bold text-primary">
                Drop images or folders to import
              </span>
              <span className="text-sm text-base-content/60">
                JPG, PNG, GIF, WebP, BMP, SVG, or folders
              </span>
            </div>
          </div>
        )}

        {content}

        <UrlImportWarningModal
          isOpen={pendingUrls.length > 0}
          urls={pendingUrls}
          onConfirm={handleUrlImportConfirm}
          onCancel={() => setPendingUrls([])}
        />

        <Modal ref={shadertoyModalRef} onClose={handleCancelShadertoy} showCloseButton={false}>
          <h3 className="font-bold text-lg mb-2">Shadertoy JSON detected</h3>
          <p className="text-sm text-base-content/70 mb-6">
            This looks like a Shadertoy export. Open it in Shader Studio?
          </p>
          <div className="flex gap-3 justify-end">
            <button className="btn btn-ghost btn-sm" onClick={handleCancelShadertoy}>
              Cancel
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleOpenInShaderStudio}>
              Open in Shader Studio
            </button>
          </div>
        </Modal>
      </div>
    </div>
  );
}

export default Gallery;
