import { create } from "zustand";

interface ImageProcessingState {
	isProcessing: boolean;
	totalImages: number;
	processedImages: number;
	currentImage: string | null;
	startTime: number | null;
	errors: number;
}

interface ImageProcessingActions {
	startProcessing: (totalImages: number) => void;
	updateProgress: (processed: number, current: string) => void;
	completeProcessing: () => void;
	reset: () => void;
}

export const useImageProcessingStore = create<
	ImageProcessingState & ImageProcessingActions
>()((set) => ({
	isProcessing: false,
	totalImages: 0,
	processedImages: 0,
	currentImage: null,
	startTime: null,
	errors: 0,

	startProcessing: (totalImages: number) =>
		set({
			isProcessing: true,
			totalImages,
			processedImages: 0,
			currentImage: null,
			startTime: Date.now(),
			errors: 0,
		}),

	updateProgress: (processed: number, current: string) =>
		set({
			processedImages: processed,
			currentImage: current,
		}),

	completeProcessing: () =>
		set({
			isProcessing: false,
			currentImage: null,
		}),

	reset: () =>
		set({
			isProcessing: false,
			totalImages: 0,
			processedImages: 0,
			currentImage: null,
			startTime: null,
			errors: 0,
		}),
}));
