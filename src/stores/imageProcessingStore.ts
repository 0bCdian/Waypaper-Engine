import { create } from "zustand";

export interface BatchProgress {
  totalImages: number;
  processedImages: number;
  currentImage: string | null;
  elapsedMs: number;
  errors: number;
}

interface ImageProcessingState {
  batches: Map<string, BatchProgress>;
}

interface ImageProcessingActions {
  startBatch: (batchId: string, totalImages: number) => void;
  updateBatch: (batchId: string, processed: number, current: string, elapsedMs: number) => void;
  completeBatch: (batchId: string) => void;
  reset: () => void;
}

export const useImageProcessingStore = create<ImageProcessingState & ImageProcessingActions>()(
  (set, get) => ({
    batches: new Map<string, BatchProgress>(),

    startBatch: (batchId: string, totalImages: number) => {
      const next = new Map(get().batches);
      next.set(batchId, {
        totalImages,
        processedImages: 0,
        currentImage: null,
        elapsedMs: 0,
        errors: 0,
      });
      set({ batches: next });
    },

    updateBatch: (batchId: string, processed: number, current: string, elapsedMs: number) => {
      const next = new Map(get().batches);
      const existing = next.get(batchId);
      if (existing) {
        next.set(batchId, {
          ...existing,
          processedImages: processed,
          currentImage: current,
          elapsedMs,
        });
      }
      set({ batches: next });
    },

    completeBatch: (batchId: string) => {
      const next = new Map(get().batches);
      next.delete(batchId);
      set({ batches: next });
    },

    reset: () => {
      set({ batches: new Map() });
    },
  }),
);
