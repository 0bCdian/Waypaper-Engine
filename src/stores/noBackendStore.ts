import { create } from "zustand";

interface State {
  visible: boolean;
}

interface Actions {
  show: () => void;
  hide: () => void;
}

export const useNoBackendStore = create<State & Actions>()((set) => ({
  visible: false,
  show: () => set({ visible: true }),
  hide: () => set({ visible: false }),
}));
