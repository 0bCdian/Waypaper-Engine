import { useEffect, useRef, startTransition } from "react";
import { useImagesStore } from "../stores/images";
import { useImageProcessingStore } from "../stores/imageProcessingStore";
import { useToastStore } from "../stores/toastStore";
import type {
	ProcessingStartedPayload,
	ImageProcessedPayload,
	ImageErrorPayload,
	ProcessingCompletePayload,
} from "../../electron/daemon-go-types";

export function useRealTimeImageProcessing() {
	const cleanupRef = useRef<(() => void) | null>(null);
	const reQueryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	useEffect(() => {
		const { startBatch, updateBatch, completeBatch } = useImageProcessingStore.getState();
		if (!window.API_RENDERER?.goDaemon?.on) {
			console.error("goDaemon event methods not available");
			return;
		}

		const { goDaemon } = window.API_RENDERER;

		const handleProcessingStarted = (...args: unknown[]) => {
			const data = args[0] as ProcessingStartedPayload;
			try {
				startBatch(data.batch_id, data.total);
			} catch (error) {
				console.error("Error handling processing_started:", error);
			}
		};

		const handleImageProcessed = async (...args: unknown[]) => {
			const data = args[0] as ImageProcessedPayload;
			const imageName = data.image ? data.image.name : "";
			try {
				const store = useImageProcessingStore.getState();
				if (!store.batches.has(data.batch_id)) {
					startBatch(data.batch_id, data.total);
				}
				updateBatch(
					data.batch_id,
					data.current,
					imageName,
					data.elapsed_ms,
				);

				if (reQueryTimeoutRef.current) {
					clearTimeout(reQueryTimeoutRef.current);
				}
				reQueryTimeoutRef.current = setTimeout(() => {
					try {
						startTransition(() => {
							useImagesStore.getState().reQueryImages();
						});
					} catch (error) {
						console.error("Error re-querying images:", error);
					}
					reQueryTimeoutRef.current = null;
				}, 1000);
			} catch (error) {
				console.error("Error handling image_processed:", error);
			}
		};

		const handleImageError = (...args: unknown[]) => {
			const data = args[0] as ImageErrorPayload;
			try {
				console.error(`Failed to process: ${data.path} - ${data.error}`);
				const { addToast } = useToastStore.getState();
				addToast(
					`Failed to process: ${data.path} - ${data.error}`,
					"error",
					7000,
				);
			} catch (error) {
				console.error("Error handling image_error:", error);
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
				console.error("Error handling processing_complete:", error);
			}
		};

		const handleImagesUpdated = () => {
			try {
				setTimeout(() => {
					startTransition(() => {
						useImagesStore.getState().reQueryImages();
					});
				}, 300);
			} catch (error) {
				console.error("Error handling images_updated:", error);
			}
		};

		const disposeStarted = goDaemon.on("processing_started", handleProcessingStarted);
		const disposeProcessed = goDaemon.on("image_processed", handleImageProcessed);
		const disposeError = goDaemon.on("image_error", handleImageError);
		const disposeComplete = goDaemon.on("processing_complete", handleProcessingComplete);
		const disposeUpdated = goDaemon.on("images_updated", handleImagesUpdated);

		cleanupRef.current = () => {
			try {
				disposeStarted();
				disposeProcessed();
				disposeError();
				disposeComplete();
				disposeUpdated();
			} catch (error) {
				console.error("Error cleaning up listeners:", error);
			}
		};

		return () => {
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
