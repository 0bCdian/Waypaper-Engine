import { useEffect, startTransition } from "react";
import { useImagesStore } from "../stores/images";
import { useImageProcessingStore } from "../stores/imageProcessingStore";
import { useToastStore } from "../stores/toastStore";
import { logger } from "../utils/logger";
import { daemonClient } from "@/client";
import type {
  ProcessingStartedPayload,
  ImageProcessedPayload,
  ImageErrorPayload,
  ProcessingCompletePayload,
  ProcessingCancelledPayload,
} from "../../electron/daemon-go-types";

const IMPORT_REQUERY_THROTTLE_MS = 2000;

export function useRealTimeImageProcessing() {
  useEffect(() => {
    let reQueryTimer: ReturnType<typeof setTimeout> | undefined;
    let lastReQueryAt = 0;

    // Every daemon event funnels through one timer, so a burst of events costs one gallery fetch.
    const reQueryAfter = (delayMs: number) => {
      clearTimeout(reQueryTimer);
      reQueryTimer = setTimeout(() => {
        reQueryTimer = undefined;
        lastReQueryAt = Date.now();
        startTransition(() => useImagesStore.getState().reQueryImages());
      }, delayMs);
    };

    const processing = () => useImageProcessingStore.getState();

    const disposers = [
      daemonClient.on("processing_started", (data) => {
        const { batch_id, total } = data as ProcessingStartedPayload;
        processing().startBatch(batch_id, total);
      }),

      daemonClient.on("image_processed", (data) => {
        const d = data as ImageProcessedPayload;
        if (!processing().batches.has(d.batch_id)) processing().startBatch(d.batch_id, d.total);
        processing().updateBatch(d.batch_id, d.current, d.image?.name ?? "", d.elapsed_ms);
        // Throttle (not debounce) so the grid fills in while a long import is still running.
        if (reQueryTimer === undefined) {
          reQueryAfter(Math.max(0, IMPORT_REQUERY_THROTTLE_MS - (Date.now() - lastReQueryAt)));
        }
      }),

      daemonClient.on("image_error", (data) => {
        const { path, error } = data as ImageErrorPayload;
        logger.error(`Failed to process: ${path} - ${error}`);
        useToastStore.getState().addToast(`Failed to process: ${path} - ${error}`, "error", 7000);
      }),

      daemonClient.on("processing_complete", (data) => {
        processing().completeBatch((data as ProcessingCompletePayload).batch_id);
        reQueryAfter(500);
      }),

      daemonClient.on("processing_cancelled", (data) => {
        const { batch_id, succeeded, total } = data as ProcessingCancelledPayload;
        processing().completeBatch(batch_id);
        useToastStore
          .getState()
          .addToast(`Import cancelled (${succeeded}/${total} images imported)`, "info", 5000);
        reQueryAfter(500);
      }),

      daemonClient.on("gallery_changed", (data) => {
        if ((data as { domain?: string })?.domain === "images") reQueryAfter(300);
      }),
    ];

    // Video preview backfill may finish before gallery_changed is subscribed, so the event is
    // missed and the gallery stays stale; one deferred refetch catches the persisted preview_path.
    reQueryAfter(2800);

    return () => {
      clearTimeout(reQueryTimer);
      for (const dispose of disposers) dispose();
    };
  }, []);
}
