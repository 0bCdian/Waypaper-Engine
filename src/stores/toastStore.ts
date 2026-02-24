import { create } from "zustand";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
	id: string;
	message: string;
	type: ToastType;
	duration?: number;
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

		set((state) => ({
			toasts: [...state.toasts, toast],
		}));

		// Auto-remove toast after duration
		if (duration > 0) {
			setTimeout(() => {
				set((state) => ({
					toasts: state.toasts.filter((t) => t.id !== id),
				}));
			}, duration);
		}
	},

	removeToast: (id: string) => {
		set((state) => ({
			toasts: state.toasts.filter((t) => t.id !== id),
		}));
	},

	clearToasts: () => {
		set({ toasts: [] });
	},
}));
