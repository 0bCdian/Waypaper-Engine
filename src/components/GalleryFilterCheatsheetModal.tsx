import { useEffect, useRef } from "react";
import Modal, { type ModalHandle } from "./Modal";
import { useModalStore } from "../stores/modalStore";
import { FILTER_PREFIX_OPTIONS } from "../utils/galleryFilterSuggestions";

const GalleryFilterCheatsheetModal = () => {
  const containerRef = useRef<ModalHandle>(null);

  useEffect(() => {
    if (containerRef.current) {
      useModalStore.getState().register("GalleryFilterCheatsheetModal", containerRef.current);
    }
    return () => useModalStore.getState().unregister("GalleryFilterCheatsheetModal");
  }, []);

  return (
    <Modal
      id="GalleryFilterCheatsheetModal"
      ref={containerRef}
      className="modal-box max-w-lg xl:max-w-xl 2xl:max-w-2xl max-h-[85vh] overflow-y-auto"
    >
      <h2 className="mb-3 text-2xl font-bold">Gallery filter syntax</h2>
      <p className="mb-4 text-sm text-base-content/80">
        Add one token per chip in the search bar. Multiple chips combine with <strong>AND</strong>{" "}
        (an image must satisfy every active token). Resolution filters live under{" "}
        <strong>Filters</strong> (advanced), not in this bar.
      </p>

      <ul className="list-inside list-disc space-y-2 text-sm">
        {FILTER_PREFIX_OPTIONS.map((p) => (
          <li key={p}>
            <code className="text-xs">{p}</code>
            {p === "tag:" && " — match images that have this tag."}
            {p === "type:" && " — one of image, video, gif, web. Several type: chips mean OR on the client; the API uses a single media_type when only one is set."}
            {p === "ext:" && " — file format (png, jpg, mp4, …) without leading dot."}
            {p === "color:" && " — exact match: stored palette must include this hex (#rgb or #rrggbb)."}
            {p === "near:" && " — perceptual match: min CIE76 ΔE from the hex to any stored swatch must be ≤ the limit, e.g. near:#ff0000~12"}
            {p === "q:" && " — text search (name and tags) on the server."}
          </li>
        ))}
      </ul>

      <p className="mt-4 text-sm text-base-content/80">
        Plain text without a prefix is treated like <code className="text-xs">q:</code> after
        splitting. Multiple <code className="text-xs">color:</code> tokens each require that swatch
        to be present (AND). Multiple <code className="text-xs">near:</code> constraints are also
        ANDed.
      </p>

      <p className="mt-3 text-xs text-base-content/60">
        Dominant colors on each image come from k-means in CIELAB at import time, stored as hex
        swatches.
      </p>
    </Modal>
  );
};

export default GalleryFilterCheatsheetModal;
