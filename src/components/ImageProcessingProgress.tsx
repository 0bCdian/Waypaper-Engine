import { useImageProcessingStore, type BatchProgress } from "../stores/imageProcessingStore";
import { confirmDialog } from "./ConfirmDialog";
import { logger } from "../utils/logger";
import { daemonClient } from "@/client";

function BatchCard({ batchId, batch }: { batchId: string; batch: BatchProgress }) {
  const { totalImages, processedImages, currentImage, elapsedMs } = batch;
  const progress = totalImages > 0 ? (processedImages / totalImages) * 100 : 0;
  const elapsedSeconds = Math.round(elapsedMs / 1000);

  const handleCancel = async () => {
    const confirmed = await confirmDialog({
      title: "Cancel Import?",
      message:
        "This will stop importing the remaining images. Images already processed will be kept.",
      confirmLabel: "Cancel Import",
      danger: true,
    });
    if (confirmed) {
      try {
        await daemonClient.cancelImport(batchId);
      } catch (err) {
        logger.error("Failed to cancel import:", err);
      }
    }
  };

  return (
    <div className="bg-base-100 p-4 rounded-lg shadow-lg min-w-80 border border-base-300">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-base-content">Processing Images</span>
        <div className="flex items-center gap-2">
          <span className="text-sm text-base-content/70">
            {processedImages}/{totalImages}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-xs btn-circle hover:btn-error"
            onClick={handleCancel}
            title="Cancel import"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3.5 w-3.5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className="w-full bg-base-300 rounded-full h-2 mb-2">
        <div
          className="bg-primary h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {currentImage && (
        <div className="text-xs text-base-content/60 truncate">Processing: {currentImage}</div>
      )}

      <div className="text-xs text-base-content/50 mt-1">{elapsedSeconds}s elapsed</div>
    </div>
  );
}

export function ImageProcessingProgress() {
  const batches = useImageProcessingStore((s) => s.batches);

  if (batches.size === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {Array.from(batches.entries()).map(([batchId, batch]) => (
        <BatchCard key={batchId} batchId={batchId} batch={batch} />
      ))}
    </div>
  );
}
