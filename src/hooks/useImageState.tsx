import { useState, useCallback } from "react";
import {
	type rendererImage,
	type ImageThumbnails,
} from "../types/rendererTypes";

interface ImageProcessingState {
	processingImages: Set<number>; // Set of image IDs being processed
	completedImages: Map<number, rendererImage>; // Map of completed images
}

interface ImageProcessedEvent {
	imageId: number;
	image: rendererImage;
}

interface ImageErrorEvent {
	imageId: number;
	originalFileName: string;
	uniqueFileName: string;
	error: string;
}

interface ProcessingCompleteEvent {
	totalProcessed: number;
	totalRequested: number;
}

export function useImageState() {
	const [state, setState] = useState<ImageProcessingState>({
		processingImages: new Set(),
		completedImages: new Map(),
	});

	// Handle image processing events from daemon
	const handleImageProcessed = useCallback((event: ImageProcessedEvent) => {
		setState((prev) => {
			const newProcessingImages = new Set(prev.processingImages);
			newProcessingImages.delete(event.imageId);

			const newCompletedImages = new Map(prev.completedImages);
			newCompletedImages.set(event.imageId, event.image);

			return {
				processingImages: newProcessingImages,
				completedImages: newCompletedImages,
			};
		});
	}, []);

	const handleImageError = useCallback((event: ImageErrorEvent) => {
		setState((prev) => {
			const newProcessingImages = new Set(prev.processingImages);
			newProcessingImages.delete(event.imageId);

			return {
				...prev,
				processingImages: newProcessingImages,
			};
		});
	}, []);

	const handleProcessingComplete = useCallback(
		(_event: ProcessingCompleteEvent) => {
			// Clear all processing images when processing is complete
			setState((prev) => ({
				...prev,
				processingImages: new Set(),
			}));
		},
		[],
	);

	// Add images to processing state
	const addProcessingImages = useCallback((imageIds: number[]) => {
		setState((prev) => {
			const newProcessingImages = new Set(prev.processingImages);
			imageIds.forEach((id) => newProcessingImages.add(id));

			return {
				...prev,
				processingImages: newProcessingImages,
			};
		});
	}, []);

	// Get thumbnail path for current screen resolution
	const getThumbnailPath = useCallback(
		(thumbnails: ImageThumbnails, screenWidth: number): string => {
			// Determine appropriate resolution based on screen width
			if (screenWidth >= 3840) {
				return thumbnails["4k"] || thumbnails.fallback;
			} else if (screenWidth >= 2560) {
				return thumbnails["1440p"] || thumbnails.fallback;
			} else if (screenWidth >= 1920) {
				return thumbnails["1080p"] || thumbnails.fallback;
			} else if (screenWidth >= 1280) {
				return thumbnails["720p"] || thumbnails.fallback;
			} else {
				return thumbnails.fallback;
			}
		},
		[],
	);

	// Check if image is being processed
	const isImageProcessing = useCallback(
		(imageId: number): boolean => {
			return state.processingImages.has(imageId);
		},
		[state.processingImages],
	);

	// Get completed image
	const getCompletedImage = useCallback(
		(imageId: number): rendererImage | undefined => {
			return state.completedImages.get(imageId);
		},
		[state.completedImages],
	);

	// Get all completed images
	const getAllCompletedImages = useCallback((): rendererImage[] => {
		return Array.from(state.completedImages.values());
	}, [state.completedImages]);

	// Clear completed images (useful for cleanup)
	const clearCompletedImages = useCallback(() => {
		setState((prev) => ({
			...prev,
			completedImages: new Map(),
		}));
	}, []);

	return {
		state,
		handleImageProcessed,
		handleImageError,
		handleProcessingComplete,
		addProcessingImages,
		getThumbnailPath,
		isImageProcessing,
		getCompletedImage,
		getAllCompletedImages,
		clearCompletedImages,
	};
}
