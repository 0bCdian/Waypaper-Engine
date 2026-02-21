import { create } from "zustand";

interface FolderPickerState {
	isOpen: boolean;
	imageIds: number[];
	open: (imageIds: number[]) => void;
	close: () => void;
}

export const useFolderPickerStore = create<FolderPickerState>()((set) => ({
	isOpen: false,
	imageIds: [],
	open: (imageIds: number[]) => set({ isOpen: true, imageIds }),
	close: () => set({ isOpen: false, imageIds: [] }),
}));
