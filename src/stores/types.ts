/**
 * Store Types and Utilities for Waypaper Engine
 *
 * Common types and utility functions for Zustand stores.
 */

import { StateCreator } from "zustand";

/**
 * Base store state interface
 */
export interface StoreState {
	isLoading: boolean;
	error: string | null;
	lastUpdated: number | null;
}

/**
 * Base store actions interface
 */
export interface StoreActions {
	setLoading: (loading: boolean) => void;
	setError: (error: string | null) => void;
	clearError: () => void;
	updateTimestamp: () => void;
}

/**
 * Store creator type
 */
export type StoreCreator<T> = StateCreator<T, [], [], T>;

/**
 * Store with devtools configuration
 */
export interface StoreWithDevtools {
	name: string;
	enabled: boolean;
}

/**
 * Store with persistence configuration
 */
export interface StoreWithPersistence {
	name: string;
	partialize?: (state: any) => any;
	version?: number;
	migrate?: (persistedState: any, version: number) => any;
}

/**
 * Create store with common state and actions
 */
export function createBaseStore<T extends StoreState & StoreActions>(
	initialState: Omit<T, keyof StoreState | keyof StoreActions>,
): StoreCreator<T> {
	return (set, _get) =>
		({
			// Base state
			isLoading: false,
			error: null,
			lastUpdated: null,

			// Base actions
			setLoading: (loading: boolean) => set({ isLoading: loading } as Partial<T>),
			setError: (error: string | null) => set({ error } as Partial<T>),
			clearError: () => set({ error: null } as Partial<T>),
			updateTimestamp: () => set({ lastUpdated: Date.now() } as Partial<T>),

			// Initial state
			...initialState,
		}) as T;
}

/**
 * Store selector type
 */
export type StoreSelector<T, R> = (state: T) => R;

/**
 * Store action type
 */
export type StoreAction<T, R = void> = (state: T) => R;

/**
 * Store subscription type
 */
export type StoreSubscription<T> = (state: T, prevState: T) => void;

/**
 * Store middleware type
 */
export type StoreMiddleware<T> = (
	config: StateCreator<T, [], [], T>,
) => StateCreator<T, [], [], T>;

/**
 * Store configuration
 */
export interface StoreConfig<T> {
	name: string;
	devtools?: boolean;
	persistence?: StoreWithPersistence;
	middleware?: StoreMiddleware<T>[];
}

/**
 * Create store with configuration
 */
export function createConfiguredStore<T>(
	config: StoreConfig<T>,
	storeCreator: StoreCreator<T>,
): StoreCreator<T> {
	let store = storeCreator;

	// Apply middleware
	if (config.middleware) {
		config.middleware.forEach((middleware) => {
			store = middleware(store);
		});
	}

	return store;
}

/**
 * Store validation utilities
 */
export class StoreValidator {
	/**
	 * Validate store state
	 */
	static validateState<T>(state: T, _schema: any): boolean {
		try {
			// Basic validation - can be extended with a proper schema library
			return typeof state === "object" && state !== null;
		} catch {
			return false;
		}
	}

	/**
	 * Sanitize store state
	 */
	static sanitizeState<T>(state: T): T {
		// Basic sanitization - can be extended
		return JSON.parse(JSON.stringify(state));
	}
}

/**
 * Store performance utilities
 */
export class StorePerformance {
	/**
	 * Debounce store updates
	 */
	static debounce<T>(
		updateFn: (state: T) => void,
		delay: number = 300,
	): (state: T) => void {
		let timeoutId: NodeJS.Timeout;

		return (state: T) => {
			clearTimeout(timeoutId);
			timeoutId = setTimeout(() => updateFn(state), delay);
		};
	}

	/**
	 * Throttle store updates
	 */
	static throttle<T>(
		updateFn: (state: T) => void,
		delay: number = 100,
	): (state: T) => void {
		let lastCall = 0;

		return (state: T) => {
			const now = Date.now();
			if (now - lastCall >= delay) {
				lastCall = now;
				updateFn(state);
			}
		};
	}
}

/**
 * Store debugging utilities
 */
export class StoreDebugger {
	/**
	 * Log store state changes
	 */
	static logStateChanges<T>(storeName: string) {
		return (state: T, prevState: T) => {
			if (process.env.NODE_ENV === "development") {
				console.group(`🔄 ${storeName} State Change`);
				console.log("Previous:", prevState);
				console.log("Current:", state);
				console.groupEnd();
			}
		};
	}

	/**
	 * Log store actions
	 */
	static logAction<T>(_storeName: string, _actionName: string) {
		return (state: T) => {
			if (process.env.NODE_ENV === "development") {
				console.log(`🎯 ${_storeName}.${_actionName}:`, state);
			}
		};
	}
}

export default {
	createBaseStore,
	createConfiguredStore,
	StoreValidator,
	StorePerformance,
	StoreDebugger,
};
