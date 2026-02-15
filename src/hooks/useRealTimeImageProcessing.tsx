import { useEffect, useRef } from "react";
import { imagesStore } from "../stores/images";
import { useImageProcessingStore } from "../stores/imageProcessingStore";
import { useToastStore } from "../stores/toastStore";
import { type rendererImage } from "../types/rendererTypes";
import {
	type DaemonProcessingStartedPayload,
	type DaemonImageProcessedPayload,
	type DaemonImageProgressPayload,
	type DaemonImageErrorPayload,
	type DaemonProcessingCompletePayload,
	type DaemonImagesUpdatedPayload,
} from "../../shared/types/daemonEvents";

export function useRealTimeImageProcessing() {
	const cleanupRef = useRef<(() => void) | null>(null);
	const reQueryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const { addImage } = imagesStore();
	const { startProcessing, updateProgress, completeProcessing } =
		useImageProcessingStore();

	useEffect(() => {
		// Add a small delay to ensure everything is initialized
		const timer = setTimeout(async () => {
			try {
				// Add safety checks to prevent catastrophic failures
				if (!window.API_RENDERER) {
					console.error("API_RENDERER not available");
					return;
				}

				if (!window.API_RENDERER.goDaemon) {
					console.error("goDaemon not available");
					return;
				}

				if (
					!window.API_RENDERER.goDaemon.on ||
					!window.API_RENDERER.goDaemon.off
				) {
					console.error("goDaemon event methods not available");
					return;
				}

				console.info("Setting up real-time image processing listeners");

				// Note: Event subscription is handled globally by useSubscribeToEvents hook
				const { goDaemon } = window.API_RENDERER;

				const handleProcessingStarted = (...args: unknown[]) => {
					const data = args[0] as DaemonProcessingStartedPayload;
					try {
						console.info("Real-time event: processing_started", data);
						startProcessing(data.totalImages);
					} catch (error) {
						console.error("Error handling processing_started event:", error);
					}
				};

				const handleImageProcessed = async (...args: unknown[]) => {
					const data = args[0] as DaemonImageProcessedPayload;
					try {
						console.info("Real-time event: image_processed", data);
						console.log(
							"🟢 Image processed event received, ID:",
							data.id,
							"File:",
							data.uniqueFileName,
						);

						// The Go daemon event doesn't include all fields (path, size, thumbnails, etc.)
						// So we need to fetch the complete image data from the daemon
						// Debounce re-queries to avoid excessive calls when processing many images
						if (reQueryTimeoutRef.current) {
							clearTimeout(reQueryTimeoutRef.current);
						}
						reQueryTimeoutRef.current = setTimeout(async () => {
							try {
								const { reQueryImages } = imagesStore.getState();
								console.log("🟢 Re-querying images to get complete data for processed images");
								await reQueryImages();
								console.log("🟢 Images re-queried successfully");
							} catch (error) {
								console.error("Error re-querying images after processing:", error);
							}
							reQueryTimeoutRef.current = null;
						}, 1000); // 1 second debounce - wait for batch of images to be processed
					} catch (error) {
						console.error("Error handling image_processed event:", error);
					}
				};

				const handleImageProgress = (...args: unknown[]) => {
					const data = args[0] as DaemonImageProgressPayload;
					try {
						console.info("Real-time event: image_progress", data);
						updateProgress(data.processed, data.current);
					} catch (error) {
						console.error("Error handling image_progress event:", error);
					}
				};

				const handleImageError = (...args: unknown[]) => {
					const data = args[0] as DaemonImageErrorPayload;
					try {
						console.error("Real-time event: image_error", data);
						console.error(
							`Failed to process image: ${data.originalFileName} - ${data.error}`,
						);

						// Show toast notification for the error
						const { addToast } = useToastStore.getState();
						addToast(
							`Failed to process: ${data.originalFileName} - ${data.error}`,
							"error",
							7000,
						);
					} catch (error) {
						console.error("Error handling image_error event:", error);
					}
				};

				const handleProcessingComplete = (...args: unknown[]) => {
					const data = args[0] as DaemonProcessingCompletePayload;
					try {
						console.info("Real-time event: processing_complete", data);
						console.log(
							`Processing complete: ${data.totalProcessed} processed`,
						);
						completeProcessing();
						
						// Final re-query to ensure all processed images are loaded
						const { reQueryImages } = imagesStore.getState();
						setTimeout(() => {
							console.log("🟢 Processing complete, performing final re-query");
							reQueryImages();
						}, 500);
					} catch (error) {
						console.error("Error handling processing_complete event:", error);
					}
				};

				const handleImagesUpdated = (...args: unknown[]) => {
					const data = args[0] as DaemonImagesUpdatedPayload;
					try {
						console.info("Real-time event: images_updated", data);
						console.log(`Images ${data.action}: ${data.count} images affected`);

						// Re-query for all actions to ensure we have the latest data
						// This is especially important for "added" since image_processed events
						// don't include all required fields (path, thumbnails, etc.)
						const { reQueryImages } = imagesStore.getState();
						console.log(
							"🟢 useRealTimeImageProcessing: Images updated, re-querying images",
						);
						// Use a small delay to ensure JSON store is fully updated
						setTimeout(() => {
							reQueryImages();
						}, 300);
					} catch (error) {
						console.error("Error handling images_updated event:", error);
					}
				};

				// Listen for real-time events from the Go daemon
				goDaemon.on("processing_started", handleProcessingStarted);
				goDaemon.on("image_processed", handleImageProcessed);
				goDaemon.on("image_progress", handleImageProgress);
				goDaemon.on("image_error", handleImageError);
				goDaemon.on("processing_complete", handleProcessingComplete);
				goDaemon.on("images_updated", handleImagesUpdated);

				console.info(
					"Real-time image processing listeners set up successfully",
				);

				// Store cleanup function
				cleanupRef.current = () => {
					try {
						// Cleanup listeners
						goDaemon.off("processing_started", handleProcessingStarted);
						goDaemon.off("image_processed", handleImageProcessed);
						goDaemon.off("image_progress", handleImageProgress);
						goDaemon.off("image_error", handleImageError);
						goDaemon.off("processing_complete", handleProcessingComplete);
						goDaemon.off("images_updated", handleImagesUpdated);
						console.info("Real-time image processing listeners cleaned up");
					} catch (error) {
						console.error("Error cleaning up real-time listeners:", error);
					}
				};
			} catch (error) {
				console.error("Error setting up real-time listeners:", error);
			}
		}, 1000); // 1 second delay

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
	}, [addImage, startProcessing, updateProgress, completeProcessing]);
}
