import { useState } from "react";
import type { rendererImage } from "../types/rendererTypes";
import type { ImageThumbnails } from "../../electron/daemon-go-types";

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

	const handleImageProcessed = (event: ImageProcessedEvent) => {
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
	};

	const handleImageError = (event: ImageErrorEvent) => {
		setState((prev) => {
			const newProcessingImages = new Set(prev.processingImages);
			newProcessingImages.delete(event.imageId);

			return {
				...prev,
				processingImages: newProcessingImages,
			};
		});
	};

	const handleProcessingComplete = (_event: ProcessingCompleteEvent) => {
		setState((prev) => ({
			...prev,
			processingImages: new Set(),
		}));
	};

	const addProcessingImages = (imageIds: number[]) => {
		setState((prev) => {
			const newProcessingImages = new Set(prev.processingImages);
			imageIds.forEach((id) => {
				newProcessingImages.add(id);
			});

			return {
				...prev,
				processingImages: newProcessingImages,
			};
		});
	};

	const getThumbnailPath = (
		thumbnails: ImageThumbnails,
		screenWidth: number,
	): string => {
		if (screenWidth >= 3840) {
			return thumbnails["4k"] || thumbnails.default;
		} else if (screenWidth >= 2560) {
			return thumbnails["1440p"] || thumbnails.default;
		} else if (screenWidth >= 1920) {
			return thumbnails["1080p"] || thumbnails.default;
		} else if (screenWidth >= 1280) {
			return thumbnails["720p"] || thumbnails.default;
		} else {
			return thumbnails.default;
		}
	};

	const isImageProcessing = (imageId: number): boolean => {
		return state.processingImages.has(imageId);
	};

	const getCompletedImage = (imageId: number): rendererImage | undefined => {
		return state.completedImages.get(imageId);
	};

	const getAllCompletedImages = (): rendererImage[] => {
		return Array.from(state.completedImages.values());
	};

	const clearCompletedImages = () => {
		setState((prev) => ({
			...prev,
			completedImages: new Map(),
		}));
	};

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
