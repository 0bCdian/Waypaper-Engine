import { useEffect, useRef, startTransition } from "react";
import { imagesStore } from "../stores/images";
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
	const { startProcessing, updateProgress, completeProcessing } =
		useImageProcessingStore();

	useEffect(() => {
		const timer = setTimeout(async () => {
			try {
				if (!window.API_RENDERER?.goDaemon?.on || !window.API_RENDERER?.goDaemon?.off) {
					console.error("goDaemon event methods not available");
					return;
				}

				const { goDaemon } = window.API_RENDERER;

				const handleProcessingStarted = (...args: unknown[]) => {
					const data = args[0] as ProcessingStartedPayload;
					try {
						startProcessing(data.total);
					} catch (error) {
						console.error("Error handling processing_started:", error);
					}
				};

				const handleImageProcessed = async (...args: unknown[]) => {
					const data = args[0] as ImageProcessedPayload;
					try {
						updateProgress(data.index + 1, data.name);

						// Debounce re-queries
						if (reQueryTimeoutRef.current) {
							clearTimeout(reQueryTimeoutRef.current);
						}
					reQueryTimeoutRef.current = setTimeout(() => {
						try {
							startTransition(() => {
								imagesStore.getState().reQueryImages();
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
						console.log(
							`Processing complete: ${data.processed} processed, ${data.errors} errors`,
						);
						completeProcessing();

					// Final re-query
					setTimeout(() => {
						startTransition(() => {
							imagesStore.getState().reQueryImages();
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
							imagesStore.getState().reQueryImages();
						});
					}, 300);
					} catch (error) {
						console.error("Error handling images_updated:", error);
					}
				};

				goDaemon.on("processing_started", handleProcessingStarted);
				goDaemon.on("image_processed", handleImageProcessed);
				goDaemon.on("image_error", handleImageError);
				goDaemon.on("processing_complete", handleProcessingComplete);
				goDaemon.on("images_updated", handleImagesUpdated);

				cleanupRef.current = () => {
					try {
						goDaemon.off("processing_started", handleProcessingStarted);
						goDaemon.off("image_processed", handleImageProcessed);
						goDaemon.off("image_error", handleImageError);
						goDaemon.off("processing_complete", handleProcessingComplete);
						goDaemon.off("images_updated", handleImagesUpdated);
					} catch (error) {
						console.error("Error cleaning up listeners:", error);
					}
				};
			} catch (error) {
				console.error("Error setting up real-time listeners:", error);
			}
		}, 1000);

		return () => {
			clearTimeout(timer);
			if (reQueryTimeoutRef.current) {
				clearTimeout(reQueryTimeoutRef.current);
				reQueryTimeoutRef.current = null;
			}
			if (cleanupRef.current) {
				cleanupRef.current();
				cleanupRef.current = null;
			}
		};
	}, [startProcessing, updateProgress, completeProcessing]);
}
