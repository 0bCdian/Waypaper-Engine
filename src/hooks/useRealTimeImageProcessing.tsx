import { useEffect, useRef } from "react";
import { imagesStore } from "../stores/images";
import { type rendererImage } from "../types/rendererTypes";

export function useRealTimeImageProcessing() {
    const cleanupRef = useRef<(() => void) | null>(null);

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

                const handleImageProcessed = (data: any) => {
                    try {
                        console.info("Real-time event: image_processed", data);
                        const newImage: rendererImage = {
                            id: data.id,
                            name: data.fileName,
                            width: data.width,
                            height: data.height,
                            format: data.format,
                            isChecked: true,
                            isSelected: false,
                            time: null
                        };
                        const { addImage } = imagesStore.getState();
                        addImage(newImage);
                    } catch (error) {
                        console.error("Error handling image_processed event:", error);
                    }
                };

                const handleImageError = (data: any) => {
                    try {
                        console.error("Real-time event: image_error", data);
                        // TODO: Potentially show a toast notification or update a specific UI element for errors
                    } catch (error) {
                        console.error("Error handling image_error event:", error);
                    }
                };

                const handleProcessingComplete = (data: any) => {
                    try {
                        console.info("Real-time event: processing_complete", data);
                        const { clearSkeletons, reQueryImages } = imagesStore.getState();
                        console.log("🟢 useRealTimeImageProcessing: Clearing skeletons and re-querying images");
                        clearSkeletons();
                        reQueryImages(); // Final refresh to ensure consistency
                    } catch (error) {
                        console.error("Error handling processing_complete event:", error);
                    }
                };

                const handleImagesUpdated = (data: any) => {
                    try {
                        console.info("Real-time event: images_updated", data);
                        const { reQueryImages } = imagesStore.getState();
                        console.log("🟢 useRealTimeImageProcessing: Images updated, re-querying images");
                        reQueryImages(); // Refresh images after deletion/addition
                    } catch (error) {
                        console.error("Error handling images_updated event:", error);
                    }
                };

                // Listen for real-time events from the Go daemon
                const { goDaemon } = window.API_RENDERER;
                goDaemon.on("image_processed", handleImageProcessed);
                goDaemon.on("image_error", handleImageError);
                goDaemon.on("processing_complete", handleProcessingComplete);
                goDaemon.on("images_updated", handleImagesUpdated);

                console.info("Real-time image processing listeners set up successfully");

                // Store cleanup function
                cleanupRef.current = () => {
                    try {
                        // Cleanup listeners
                        goDaemon.off("image_processed", handleImageProcessed);
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
    }, []);
}
