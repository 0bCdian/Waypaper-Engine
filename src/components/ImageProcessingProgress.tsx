import {
	useImageProcessingStore,
	type BatchProgress,
} from "../stores/imageProcessingStore";

function BatchCard({ batch }: { batch: BatchProgress }) {
	const { totalImages, processedImages, currentImage, elapsedMs } = batch;
	const progress = totalImages > 0 ? (processedImages / totalImages) * 100 : 0;
	const elapsedSeconds = Math.round(elapsedMs / 1000);

	return (
		<div className="bg-base-100 p-4 rounded-lg shadow-lg min-w-80 border border-base-300">
			<div className="flex items-center justify-between mb-2">
				<span className="text-sm font-medium text-base-content">
					Processing Images
				</span>
				<span className="text-sm text-base-content/70">
					{processedImages}/{totalImages}
				</span>
			</div>

			<div className="w-full bg-base-300 rounded-full h-2 mb-2">
				<div
					className="bg-primary h-2 rounded-full transition-all duration-300"
					style={{ width: `${progress}%` }}
				/>
			</div>

			{currentImage && (
				<div className="text-xs text-base-content/60 truncate">
					Processing: {currentImage}
				</div>
			)}

			<div className="text-xs text-base-content/50 mt-1">
				{elapsedSeconds}s elapsed
			</div>
		</div>
	);
}

export function ImageProcessingProgress() {
	const batches = useImageProcessingStore((s) => s.batches);

	if (batches.size === 0) return null;

	return (
		<div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
			{Array.from(batches.entries()).map(([batchId, batch]) => (
				<BatchCard key={batchId} batch={batch} />
			))}
		</div>
	);
}
