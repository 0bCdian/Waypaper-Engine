import { create } from "zustand";
import type { ConfigSection } from "@/shared/types/unifiedConfig";

interface SettingsModalState {
  open: boolean;
  initialSection: ConfigSection | null;
  openModal: (section?: ConfigSection) => void;
  closeModal: () => void;
}

export const useSettingsModalStore = create<SettingsModalState>((set) => ({
  open: false,
  initialSection: null,
  openModal: (section) => set({ open: true, initialSection: section ?? null }),
  closeModal: () => set({ open: false }),
}));
