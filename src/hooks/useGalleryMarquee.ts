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
const SCROLL_ZONE_PX = 80;
const SCROLL_MAX_SPEED = 16;

export function useGalleryMarquee() {
  const setSelectedImages = useImagesStore((s) => s.setSelectedImages);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [marqueeBox, setMarqueeBox] = useState<MarqueeBox | null>(null);
  const marqueeLiveRef = useRef<MarqueeBox | null>(null);
  const shiftDuringMarqueeRef = useRef(false);
  const scrollRafRef = useRef<number | null>(null);
  const scrollContainerRef = useRef<Element | null>(null);
  // Drag origin in document coordinates (client + scrollTop at drag start)
  const dragDocOriginRef = useRef<{ x: number; y: number } | null>(null);

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

      // Capture the gallery scroll container once at drag start
      const scrollEl = gridRef.current?.parentElement ?? null;
      scrollContainerRef.current = scrollEl;
      // Record drag origin in document space so the selection rect stays correct
      // even after the gallery has auto-scrolled during the drag.
      dragDocOriginRef.current = {
        x: clientX + (scrollEl?.scrollLeft ?? 0),
        y: clientY + (scrollEl?.scrollTop ?? 0),
      };

      const stopScroll = () => {
        if (scrollRafRef.current !== null) {
          cancelAnimationFrame(scrollRafRef.current);
          scrollRafRef.current = null;
        }
      };

      const onMove = (ev: PointerEvent) => {
        const cur = marqueeLiveRef.current;
        if (!cur) return;
        // x2/y2 are client coords — used only for the visual overlay (position: fixed)
        const next: MarqueeBox = { ...cur, x2: ev.clientX, y2: ev.clientY };
        marqueeLiveRef.current = next;
        setMarqueeBox(next);

        // Auto-scroll when dragging near scroll container edges
        stopScroll();
        if (!scrollEl) return;
        const rect = scrollEl.getBoundingClientRect();
        let dy = 0;
        if (ev.clientY > rect.bottom - SCROLL_ZONE_PX) {
          dy = SCROLL_MAX_SPEED * Math.min(1, (ev.clientY - (rect.bottom - SCROLL_ZONE_PX)) / SCROLL_ZONE_PX);
        } else if (ev.clientY < rect.top + SCROLL_ZONE_PX) {
          dy = -SCROLL_MAX_SPEED * Math.min(1, ((rect.top + SCROLL_ZONE_PX) - ev.clientY) / SCROLL_ZONE_PX);
        }
        if (dy !== 0) {
          const step = () => {
            scrollEl.scrollBy(0, dy);
            scrollRafRef.current = requestAnimationFrame(step);
          };
          scrollRafRef.current = requestAnimationFrame(step);
        }
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        document.documentElement.style.userSelect = "";
        stopScroll();

        const prev = marqueeLiveRef.current;
        const origin = dragDocOriginRef.current;
        marqueeLiveRef.current = null;
        dragDocOriginRef.current = null;
        scrollContainerRef.current = null;
        setMarqueeBox(null);

        if (!prev || !origin || !gridRef.current) return;

        // Convert everything to document coordinates so images that scrolled out
        // of the viewport are still correctly included in the selection.
        const scrollLeft = scrollEl?.scrollLeft ?? 0;
        const scrollTop = scrollEl?.scrollTop ?? 0;
        const docX2 = prev.x2 + scrollLeft;
        const docY2 = prev.y2 + scrollTop;

        const left = Math.min(origin.x, docX2);
        const top = Math.min(origin.y, docY2);
        const right = Math.max(origin.x, docX2);
        const bottom = Math.max(origin.y, docY2);
        const w = right - left;
        const h = bottom - top;
        if (w < 4 && h < 4) return;

        const selRect = { left, top, right, bottom };
        const roots = gridRef.current.querySelectorAll<HTMLElement>("[data-gallery-image-root]");
        const hitIds = new Set<number>();
        for (const root of roots) {
          const r = root.getBoundingClientRect();
          // Convert image viewport rect → document coordinates to match selRect
          const imgDoc = {
            left: r.left + scrollLeft,
            top: r.top + scrollTop,
            right: r.right + scrollLeft,
            bottom: r.bottom + scrollTop,
          };
          if (rectsIntersect(imgDoc as DOMRect, selRect)) {
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
