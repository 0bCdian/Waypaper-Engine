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
    type DaemonImagesUpdatedPayload
} from "../../shared/types/daemonEvents";

export function useRealTimeImageProcessing() {
    const cleanupRef = useRef<(() => void) | null>(null);
    const { addImage } = imagesStore();
    const { startProcessing, updateProgress, completeProcessing } = useImageProcessingStore();

    useEffect(() => {
        // Add a small delay to ensure everything is initialized
        const timer = setTimeout(() => {
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

                if (!window.API_RENDERER.goDaemon.on || !window.API_RENDERER.goDaemon.off) {
                    console.error("goDaemon event methods not available");
                    return;
                }

                console.info("Setting up real-time image processing listeners");

                const handleProcessingStarted = (...args: unknown[]) => {
                    const data = args[0] as DaemonProcessingStartedPayload;
                    try {
                        console.info("Real-time event: processing_started", data);
                        startProcessing(data.totalImages);
                    } catch (error) {
                        console.error("Error handling processing_started event:", error);
                    }
                };

                const handleImageProcessed = (...args: unknown[]) => {
                    const data = args[0] as DaemonImageProcessedPayload;
                    try {
                        console.info("Real-time event: image_processed", data);
                        console.log("🟢 Creating new image object from event data, ID:", data.id);
                        const newImage: rendererImage = {
                            id: parseInt(data.id),
                            name: data.uniqueFileName,
                            path: data.path,
                            mediaType: "image",
                            dimensions: {
                                width: data.width,
                                height: data.height
                            },
                            metadata: {
                                format: data.format,
                                fileSize: data.size,
                                checksum: "",
                                tags: [],
                                properties: {}
                            },
                            selection: {
                                isChecked: false,
                                isSelected: false,
                                selectedAt: undefined,
                                selectedPlaylists: []
                            },
                            importInfo: {
                                importedAt: new Date(data.createdAt * 1000).toISOString(),
                                sourcePath: data.path,
                                importer: "daemon"
                            },
                            thumbnails: {
                                "720p": data.thumbnails?.["720p"] || data.thumbnails?.["fallback"] || "",
                                "1080p": data.thumbnails?.["1080p"] || data.thumbnails?.["fallback"] || "",
                                "1440p": data.thumbnails?.["1440p"] || data.thumbnails?.["fallback"] || "",
                                "4k": data.thumbnails?.["4k"] || data.thumbnails?.["fallback"] || "",
                                fallback: data.thumbnails?.["fallback"] || data.thumbnails?.["720p"] || data.thumbnails?.["1080p"] || ""
                            },
                            time: null
                        };
                        console.log("🟢 About to call addImage with:", newImage);
                        addImage(newImage);
                        console.log("🟢 addImage called successfully");
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
                        console.error(`Failed to process image: ${data.originalFileName} - ${data.error}`);
                        
                        // Show toast notification for the error
                        const { addToast } = useToastStore.getState();
                        addToast(
                            `Failed to process: ${data.originalFileName} - ${data.error}`,
                            "error",
                            7000
                        );
                    } catch (error) {
                        console.error("Error handling image_error event:", error);
                    }
                };

                const handleProcessingComplete = (...args: unknown[]) => {
                    const data = args[0] as DaemonProcessingCompletePayload;
                    try {
                        console.info("Real-time event: processing_complete", data);
                        console.log(`Processing complete: ${data.totalProcessed} processed`);
                        completeProcessing();
                    } catch (error) {
                        console.error("Error handling processing_complete event:", error);
                    }
                };

                const handleImagesUpdated = (...args: unknown[]) => {
                    const data = args[0] as DaemonImagesUpdatedPayload;
                    try {
                        console.info("Real-time event: images_updated", data);
                        console.log(`Images ${data.action}: ${data.count} images affected`);
                        
                        // Only reQuery for delete/update actions, not for "added"
                        // since we're already adding images in real-time via image_processed events
                        if (data.action === "removed" || data.action === "updated") {
                            const { reQueryImages } = imagesStore.getState();
                            console.log("🟢 useRealTimeImageProcessing: Images updated, re-querying images");
                            reQueryImages();
                        }
                    } catch (error) {
                        console.error("Error handling images_updated event:", error);
                    }
                };

                // Listen for real-time events from the Go daemon
                const { goDaemon } = window.API_RENDERER;
                goDaemon.on("processing_started", handleProcessingStarted);
                goDaemon.on("image_processed", handleImageProcessed);
                goDaemon.on("image_progress", handleImageProgress);
                goDaemon.on("image_error", handleImageError);
                goDaemon.on("processing_complete", handleProcessingComplete);
                goDaemon.on("images_updated", handleImagesUpdated);

                console.info("Real-time image processing listeners set up successfully");

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
            if (cleanupRef.current) {
                cleanupRef.current();
                cleanupRef.current = null;
            }
        };
    }, [addImage, startProcessing, updateProgress, completeProcessing]);
}
