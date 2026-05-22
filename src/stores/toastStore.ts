import { create } from "zustand";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

/** Oldest toasts are dropped when exceeded — keeps noisy SSE bursts readable */
const MAX_VISIBLE_TOASTS = 2;

const dismissTimers = new Map<string, ReturnType<typeof setTimeout>>();

function clearDismissTimer(id: string) {
  const t = dismissTimers.get(id);
  if (t !== undefined) {
    clearTimeout(t);
    dismissTimers.delete(id);
  }
}

interface State {
  toasts: Toast[];
}

interface Actions {
  addToast: (message: string, type: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

export const useToastStore = create<State & Actions>()((set) => ({
  toasts: [],

  addToast: (message: string, type: ToastType, duration: number = 5000) => {
    const id = `${Date.now()}-${Math.random()}`;
    const toast: Toast = { id, message, type, duration };

    set((state) => {
      const next = [...state.toasts, toast];
      while (next.length > MAX_VISIBLE_TOASTS) {
        const dropped = next.shift();
        if (dropped) clearDismissTimer(dropped.id);
      }
      return { toasts: next };
    });

    if (duration > 0) {
      const timer = setTimeout(() => {
        dismissTimers.delete(id);
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, duration);
      dismissTimers.set(id, timer);
    }
  },

  removeToast: (id: string) => {
    clearDismissTimer(id);
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  clearToasts: () => {
    set((state) => {
      for (const t of state.toasts) clearDismissTimer(t.id);
      return { toasts: [] };
    });
  },
}));
