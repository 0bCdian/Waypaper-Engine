import { useEffect, useRef, startTransition } from "react";
import { useImagesStore } from "../stores/images";
import { useImageProcessingStore } from "../stores/imageProcessingStore";
import { useToastStore } from "../stores/toastStore";
import { logger } from "../utils/logger";
import type {
  ProcessingStartedPayload,
  ImageProcessedPayload,
  ImageErrorPayload,
  ProcessingCompletePayload,
  ProcessingCancelledPayload,
} from "../../electron/daemon-go-types";

function safeReQueryImages(): void {
  try {
    startTransition(() => {
      useImagesStore.getState().reQueryImages();
    });
  } catch (error) {
    logger.error("Error re-querying images:", error);
  }
}

function safeProcessImageBatch(
  data: ImageProcessedPayload,
  lastReQueryRef: { current: number },
  reQueryTimeoutRef: { current: ReturnType<typeof setTimeout> | null },
): void {
  try {
    const imageName = data.image ? data.image.name : "";
    const store = useImageProcessingStore.getState();
    if (!store.batches.has(data.batch_id)) {
      store.startBatch(data.batch_id, data.total);
    }
    store.updateBatch(data.batch_id, data.current, imageName, data.elapsed_ms);
    const THROTTLE_MS = 2000;
    const now = Date.now();
    const elapsed = now - lastReQueryRef.current;
    if (!reQueryTimeoutRef.current) {
      const delay = elapsed >= THROTTLE_MS ? 0 : THROTTLE_MS - elapsed;
      reQueryTimeoutRef.current = setTimeout(() => {
        lastReQueryRef.current = Date.now();
        reQueryTimeoutRef.current = null;
        safeReQueryImages();
      }, delay);
    }
  } catch (error) {
    logger.error("Error handling image_processed:", error);
  }
}

export function useRealTimeImageProcessing() {
  const cleanupRef = useRef<(() => void) | null>(null);
  const reQueryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastReQueryRef = useRef<number>(0);

  useEffect(() => {
    const { startBatch, completeBatch } = useImageProcessingStore.getState();
    if (!window.API_RENDERER?.goDaemon?.on) {
      logger.error("goDaemon event methods not available");
      return;
    }

    const { goDaemon } = window.API_RENDERER;

    const handleProcessingStarted = (...args: unknown[]) => {
      const data = args[0] as ProcessingStartedPayload;
      try {
        startBatch(data.batch_id, data.total);
      } catch (error) {
        logger.error("Error handling processing_started:", error);
      }
    };

    const handleImageProcessed = (...args: unknown[]) => {
      const data = args[0] as ImageProcessedPayload;
      safeProcessImageBatch(data, lastReQueryRef, reQueryTimeoutRef);
    };

    const handleImageError = (...args: unknown[]) => {
      const data = args[0] as ImageErrorPayload;
      try {
        logger.error(`Failed to process: ${data.path} - ${data.error}`);
        const { addToast } = useToastStore.getState();
        addToast(`Failed to process: ${data.path} - ${data.error}`, "error", 7000);
      } catch (error) {
        logger.error("Error handling image_error:", error);
      }
    };

    const handleProcessingComplete = (...args: unknown[]) => {
      const data = args[0] as ProcessingCompletePayload;
      try {
        completeBatch(data.batch_id);

        setTimeout(() => {
          startTransition(() => {
            useImagesStore.getState().reQueryImages();
          });
        }, 500);
      } catch (error) {
        logger.error("Error handling processing_complete:", error);
      }
    };

    const handleProcessingCancelled = (...args: unknown[]) => {
      const data = args[0] as ProcessingCancelledPayload;
      try {
        completeBatch(data.batch_id);

        const { addToast } = useToastStore.getState();
        addToast(
          `Import cancelled (${data.succeeded}/${data.total} images imported)`,
          "info",
          5000,
        );

        setTimeout(() => {
          startTransition(() => {
            useImagesStore.getState().reQueryImages();
          });
        }, 500);
      } catch (error) {
        logger.error("Error handling processing_cancelled:", error);
      }
    };

    const handleGalleryChanged = (data: unknown) => {
      const payload = data as { domain?: string };
      if (payload?.domain !== "images") return;
      try {
        setTimeout(() => {
          startTransition(() => {
            useImagesStore.getState().reQueryImages();
          });
        }, 300);
      } catch (error) {
        logger.error("Error handling gallery_changed (images):", error);
      }
    };

    const disposeStarted = goDaemon.on("processing_started", handleProcessingStarted);
    const disposeProcessed = goDaemon.on("image_processed", handleImageProcessed);
    const disposeError = goDaemon.on("image_error", handleImageError);
    const disposeComplete = goDaemon.on("processing_complete", handleProcessingComplete);
    const disposeCancelled = goDaemon.on("processing_cancelled", handleProcessingCancelled);
    const disposeUpdated = goDaemon.on("gallery_changed", handleGalleryChanged);

    // Video preview backfill (and similar async daemon work) may finish before this hook
    // registers gallery_changed, so the SSE event is missed and the gallery stays stale.
    // One deferred refetch catches persisted preview_path without relying on event ordering.
    const backfillCatchupId = window.setTimeout(() => {
      startTransition(() => {
        useImagesStore.getState().reQueryImages();
      });
    }, 2800);

    cleanupRef.current = () => {
      try {
        disposeStarted();
        disposeProcessed();
        disposeError();
        disposeComplete();
        disposeCancelled();
        disposeUpdated();
      } catch (error) {
        logger.error("Error cleaning up listeners:", error);
      }
    };

    return () => {
      clearTimeout(backfillCatchupId);
      if (reQueryTimeoutRef.current) {
        clearTimeout(reQueryTimeoutRef.current);
        reQueryTimeoutRef.current = null;
      }
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, []);
}
