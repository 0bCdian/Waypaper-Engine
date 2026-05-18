import { create } from "zustand";

interface StartupIntroGateState {
  /** True once the StartupIntro overlay has finished or was skipped (settings / reduced motion). */
  introFinished: boolean;
  setIntroFinished: (value: boolean) => void;
}

export const useStartupIntroGateStore = create<StartupIntroGateState>((set) => ({
  introFinished: false,
  setIntroFinished: (value) => set({ introFinished: value }),
}));
