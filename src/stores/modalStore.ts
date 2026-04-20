import { create } from "zustand";
import type { ModalHandle } from "../components/Modal";

type ModalId =
  | "LoadPlaylistModal"
  | "savePlaylistModal"
  | "playlistConfigurationModal"
  | "AdvancedFiltersModal"
  | "GalleryFilterCheatsheetModal"
  | "monitors";

interface ModalStoreState {
  refs: Map<ModalId, ModalHandle>;
  register: (id: ModalId, handle: ModalHandle) => void;
  unregister: (id: ModalId) => void;
  open: (id: ModalId) => void;
  close: (id: ModalId) => void;
}

export const useModalStore = create<ModalStoreState>((set, get) => ({
  refs: new Map(),
  register: (id, handle) => {
    const refs = new Map(get().refs);
    refs.set(id, handle);
    set({ refs });
  },
  unregister: (id) => {
    const refs = new Map(get().refs);
    refs.delete(id);
    set({ refs });
  },
  open: (id) => get().refs.get(id)?.showModal(),
  close: (id) => get().refs.get(id)?.close(),
}));
