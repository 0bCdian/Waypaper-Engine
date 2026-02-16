/**
 * Store Utility Functions for Waypaper Engine
 *
 * Utility functions for creating and managing Zustand stores.
 */

import type { StateCreator } from "zustand";
import { devtools } from "zustand/middleware";
import { persist } from "zustand/middleware";

/**
 * Create store with devtools support
 */
export function withDevtools<T>(
	storeCreator: StateCreator<T>,
	name: string,
): StateCreator<T> {
	return devtools(storeCreator, {
		name,
		enabled: process.env.NODE_ENV === "development",
	}) as StateCreator<T>;
}

/**
 * Create store with persistence support
 */
export function withPersistence<T>(
	storeCreator: StateCreator<T>,
	config: {
		name: string;
		partialize?: (state: T) => Partial<T>;
		version?: number;
		migrate?: (persistedState: any, version: number) => T;
	},
): StateCreator<T> {
	return persist(storeCreator, {
		name: config.name,
		partialize: config.partialize,
		version: config.version,
		migrate: config.migrate,
	}) as StateCreator<T>;
}

/**
 * Create store with both devtools and persistence
 */
export function createStore<T>(
	storeCreator: StateCreator<T, [], [], T>,
	config: {
		name: string;
		devtools?: boolean;
		persistence?: {
			partialize?: (state: T) => Partial<T>;
			version?: number;
			migrate?: (persistedState: any, version: number) => T;
		};
	},
): StateCreator<T, [], [], T> {
	let store = storeCreator;

	// Add persistence if configured
	if (config.persistence) {
		store = withPersistence(store, {
			name: config.name,
			...config.persistence,
		});
	}

	// Add devtools if configured
	if (config.devtools !== false) {
		store = withDevtools(store, config.name);
	}

	return store;
}

/**
 * Store middleware for logging
 */
export function withLogging<T>(
	storeCreator: StateCreator<T, [], [], T>,
	storeName: string,
): StateCreator<T, [], [], T> {
	return (set, get, api) => {
		const store = storeCreator(set, get, api);

		// Log state changes in development
		if (process.env.NODE_ENV === "development") {
			const originalSet = set;
			set = ((partial: any, replace?: any) => {
				console.group(`🔄 ${storeName} State Update`);
				console.log("Previous state:", get());
				console.log("Update:", partial);
				originalSet(partial, replace);
				console.log("New state:", get());
				console.groupEnd();
			}) as typeof set;
		}

		return store;
	};
}

/**
 * Store middleware for error handling
 */
export function withErrorHandling<T>(
	storeCreator: StateCreator<T, [], [], T>,
): StateCreator<T, [], [], T> {
	return (set, get, api) => {
		const store = storeCreator(set, get, api);

		// Wrap actions with error handling
		const wrappedStore = { ...store };

		Object.keys(store as Record<string, any>).forEach((key) => {
			const value = store[key as keyof T];
			if (typeof value === "function") {
				wrappedStore[key as keyof T] = ((...args: any[]) => {
					try {
						return (value as any)(...args);
					} catch (error) {
						console.error(`Error in store action ${key}:`, error);
						set({
							error: error instanceof Error ? error.message : "Unknown error",
						} as any);
						throw error;
					}
				}) as any;
			}
		});

		return wrappedStore;
	};
}

/**
 * Store middleware for performance monitoring
 */
export function withPerformanceMonitoring<T>(
	storeCreator: StateCreator<T, [], [], T>,
	storeName: string,
): StateCreator<T, [], [], T> {
	return (set, get, api) => {
		const store = storeCreator(set, get, api);

		// Monitor performance in development
		if (process.env.NODE_ENV === "development") {
			const originalSet = set;
			set = ((partial: any, replace?: any) => {
				const start = performance.now();
				originalSet(partial, replace);
				const end = performance.now();

				if (end - start > 10) {
					console.warn(`⚠️ Slow store update in ${storeName}: ${end - start}ms`);
				}
			}) as typeof set;
		}

		return store;
	};
}

/**
 * Store middleware for validation
 */
export function withValidation<T>(
	storeCreator: StateCreator<T, [], [], T>,
	validator: (state: T) => boolean,
): StateCreator<T, [], [], T> {
	return (set, get, api) => {
		const store = storeCreator(set, get, api);

		const originalSet = set;
		set = ((partial: any, replace?: any) => {
			const newState = typeof partial === "function" ? partial(get()) : partial;
			const mergedState = { ...get(), ...newState };

			if (!validator(mergedState)) {
				console.error("Store validation failed:", mergedState);
				throw new Error("Invalid store state");
			}

			originalSet(partial, replace);
		}) as typeof set;

		return store;
	};
}

/**
 * Store middleware for subscriptions
 */
export function withSubscriptions<T>(
	storeCreator: StateCreator<T, [], [], T>,
): StateCreator<T, [], [], T> {
	return (set, get, api) => {
		const store = storeCreator(set, get, api);
		const subscriptions = new Set<(state: T, prevState: T) => void>();

		const originalSet = set;
		set = ((partial: any, replace?: any) => {
			const prevState = get();
			originalSet(partial, replace);
			const newState = get();

			subscriptions.forEach((subscription) => {
				try {
					subscription(newState, prevState);
				} catch (error) {
					console.error("Subscription error:", error);
				}
			});
		}) as typeof set;

		// Add subscription method
		(store as any).subscribe = (callback: (state: T, prevState: T) => void) => {
			subscriptions.add(callback);
			return () => subscriptions.delete(callback);
		};

		return store;
	};
}

export default {
	withDevtools,
	withPersistence,
	createStore,
	withLogging,
	withErrorHandling,
	withPerformanceMonitoring,
	withValidation,
	withSubscriptions,
};
