import { create } from "zustand";
import type { ReactNode } from "react";

export type MenuItem =
	| {
			type: "action";
			label: string;
			icon?: ReactNode;
			onClick: () => void;
			disabled?: boolean;
			danger?: boolean;
	  }
	| {
			type: "submenu";
			label: string;
			icon?: ReactNode;
			children: MenuItem[];
	  }
	| { type: "separator" };

interface ContextMenuState {
	isOpen: boolean;
	position: { x: number; y: number };
	items: MenuItem[];
	open: (e: React.MouseEvent, items: MenuItem[]) => void;
	close: () => void;
}

export const useContextMenuStore = create<ContextMenuState>()((set) => ({
	isOpen: false,
	position: { x: 0, y: 0 },
	items: [],

	open: (e, items) => {
		e.preventDefault();
		e.stopPropagation();
		set({
			isOpen: true,
			position: { x: e.clientX, y: e.clientY },
			items,
		});
	},

	close: () => set({ isOpen: false }),
}));
