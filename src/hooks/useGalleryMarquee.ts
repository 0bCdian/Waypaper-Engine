import { useCallback, useRef, useState } from "react";
import { useImagesStore } from "../stores/images";
import { shouldBlockGalleryMarqueeStart } from "../utils/galleryMarqueeStart";

type MarqueeBox = { x1: number; y1: number; x2: number; y2: number };

function rectsIntersect(
  a: DOMRect,
  b: { left: number; top: number; right: number; bottom: number },
): boolean {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

/**
 * Marquee (rubber-band) selection for the gallery: shared between the scroll area, filters strip gaps, and padding.
 */
export function useGalleryMarquee() {
  const setSelectedImages = useImagesStore((s) => s.setSelectedImages);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [marqueeBox, setMarqueeBox] = useState<MarqueeBox | null>(null);
  const marqueeLiveRef = useRef<MarqueeBox | null>(null);
  const shiftDuringMarqueeRef = useRef(false);

  const onMarqueePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      if (shouldBlockGalleryMarqueeStart(e.target)) return;

      e.preventDefault();
      shiftDuringMarqueeRef.current = e.shiftKey;
      const { clientX, clientY } = e;
      const start: MarqueeBox = { x1: clientX, y1: clientY, x2: clientX, y2: clientY };
      marqueeLiveRef.current = start;
      setMarqueeBox(start);
      document.documentElement.style.userSelect = "none";

      const onMove = (ev: PointerEvent) => {
        const cur = marqueeLiveRef.current;
        if (!cur) return;
        const next: MarqueeBox = { ...cur, x2: ev.clientX, y2: ev.clientY };
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

  return { onMarqueePointerDown, gridRef, marqueeBox };
}
