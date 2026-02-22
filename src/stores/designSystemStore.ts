/**
 * Design System Store for Waypaper Engine
 *
 * Manages the neobrutalist design overlay that layers on top of any
 * DaisyUI theme. Persists user preferences to localStorage and applies
 * the `data-design` attribute + CSS custom properties on the root element.
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { logger } from "../utils/logger";

/* ── Types ─────────────────────────────────────────────────────── */

export interface NeoConfig {
	/** Horizontal shadow offset in px (1-6). */
	shadowOffsetX: number;
	/** Vertical shadow offset in px (1-6). */
	shadowOffsetY: number;
	/** Border width in px (1-4). */
	borderWidth: number;
	/** Corner radius in rem (0-1). */
	cornerRadius: number;
	/** Enable polaroid-style image cards. */
	polaroidCards: boolean;
}

export type DesignMode = "default" | "neobrutalist";

interface DesignSystemState {
	designMode: DesignMode;
	neoConfig: NeoConfig;
}

interface DesignSystemActions {
	setDesignMode: (mode: DesignMode) => void;
	updateNeoConfig: (partial: Partial<NeoConfig>) => void;
	/** Re-apply the current state to the DOM (e.g. after hydration). */
	syncToDOM: () => void;
}

type DesignSystemStore = DesignSystemState & DesignSystemActions;

/* ── Defaults ──────────────────────────────────────────────────── */

const DEFAULT_NEO_CONFIG: NeoConfig = {
	shadowOffsetX: 4,
	shadowOffsetY: 4,
	borderWidth: 3,
	cornerRadius: 0,
	polaroidCards: true,
};

const STORAGE_KEY = "waypaper-design-system";

/* ── Persistence helpers ───────────────────────────────────────── */

function loadFromStorage(): Partial<DesignSystemState> {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return {};
		return JSON.parse(raw) as Partial<DesignSystemState>;
	} catch {
		return {};
	}
}

function saveToStorage(state: DesignSystemState) {
	try {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				designMode: state.designMode,
				neoConfig: state.neoConfig,
			}),
		);
	} catch {
		logger.warn("Failed to persist design system state");
	}
}

/* ── DOM side-effects ──────────────────────────────────────────── */

function applyToDOM(state: DesignSystemState) {
	const root = document.documentElement;

	if (state.designMode === "neobrutalist") {
		root.setAttribute("data-design", "neobrutalist");

		const { shadowOffsetX, shadowOffsetY, borderWidth, cornerRadius } =
			state.neoConfig;
		root.style.setProperty("--neo-shadow-x", `${shadowOffsetX}px`);
		root.style.setProperty("--neo-shadow-y", `${shadowOffsetY}px`);
		root.style.setProperty("--neo-border-width", `${borderWidth}px`);
		root.style.setProperty("--neo-radius", `${cornerRadius}rem`);
	} else {
		root.removeAttribute("data-design");
		root.style.removeProperty("--neo-shadow-x");
		root.style.removeProperty("--neo-shadow-y");
		root.style.removeProperty("--neo-border-width");
		root.style.removeProperty("--neo-radius");
	}
}

/* ── Store ─────────────────────────────────────────────────────── */

const persisted = loadFromStorage();

export const useDesignSystemStore = create<DesignSystemStore>()(
	devtools(
		(set, get) => ({
			designMode: persisted.designMode ?? "default",
			neoConfig: { ...DEFAULT_NEO_CONFIG, ...persisted.neoConfig },

			setDesignMode(mode) {
				set({ designMode: mode }, false, "setDesignMode");
				const state = get();
				saveToStorage(state);
				applyToDOM(state);
			},

			updateNeoConfig(partial) {
				set(
					(prev) => ({
						neoConfig: { ...prev.neoConfig, ...partial },
					}),
					false,
					"updateNeoConfig",
				);
				const state = get();
				saveToStorage(state);
				applyToDOM(state);
			},

			syncToDOM() {
				applyToDOM(get());
			},
		}),
		{ name: "design-system" },
	),
);

/* ── Apply on first load ───────────────────────────────────────── */
applyToDOM({
	designMode: useDesignSystemStore.getState().designMode,
	neoConfig: useDesignSystemStore.getState().neoConfig,
});
