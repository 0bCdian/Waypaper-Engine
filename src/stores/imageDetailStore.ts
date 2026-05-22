import { create } from "zustand";
import type { Image } from "../../electron/daemon-go-types";

interface ImageDetailState {
  selectedImage: Image | null;
  isOpen: boolean;
  open: (image: Image) => void;
  close: () => void;
}

export const useImageDetailStore = create<ImageDetailState>()((set) => ({
  selectedImage: null,
  isOpen: false,

  open: (image) => set({ selectedImage: image, isOpen: true }),
  close: () => set({ isOpen: false }),
}));
