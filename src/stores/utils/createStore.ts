/**
 * Store Utility Functions for Waypaper Engine
 *
 * Utility functions for creating and managing Zustand stores.
 */

import type { StateCreator } from "zustand";
import { devtools } from "zustand/middleware";
import { persist } from "zustand/middleware";

type SetStateAction<T> = T | Partial<T> | ((state: T) => T | Partial<T>);

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
		migrate?: (persistedState: unknown, version: number) => T;
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
			migrate?: (persistedState: unknown, version: number) => T;
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
			set = ((partial: SetStateAction<T>, replace?: boolean | undefined) => {
				console.group(`🔄 ${storeName} State Update`);
				console.log("Previous state:", get());
				console.log("Update:", partial);
				originalSet(partial as Partial<T>, replace as undefined);
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

		for (const key of Object.keys(store as Record<string, unknown>)) {
			const value = store[key as keyof T];
			if (typeof value === "function") {
				wrappedStore[key as keyof T] = ((...args: unknown[]) => {
					try {
						return (value as (...args: unknown[]) => unknown)(...args);
					} catch (error) {
						console.error(`Error in store action ${key}:`, error);
						set({
							error: error instanceof Error ? error.message : "Unknown error",
						} as Partial<T>);
						throw error;
					}
				}) as T[keyof T];
			}
		}

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
			set = ((partial: SetStateAction<T>, replace?: boolean | undefined) => {
				const start = performance.now();
				originalSet(partial as Partial<T>, replace as undefined);
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
		set = ((partial: SetStateAction<T>, replace?: boolean | undefined) => {
			const newState =
				typeof partial === "function"
					? (partial as (state: T) => Partial<T>)(get())
					: partial;
			const mergedState = { ...get(), ...newState };

			if (!validator(mergedState as T)) {
				console.error("Store validation failed:", mergedState);
				throw new Error("Invalid store state");
			}

			originalSet(partial as Partial<T>, replace as undefined);
		}) as typeof set;

		return store;
	};
}

/**
 * Store middleware for subscriptions
 */
export function withSubscriptions<T>(
	storeCreator: StateCreator<T, [], [], T>,
): StateCreator<
	T & { subscribe: (callback: (state: T, prevState: T) => void) => () => void },
	[],
	[],
	T & { subscribe: (callback: (state: T, prevState: T) => void) => () => void }
> {
	return (set, get, api) => {
		const store = storeCreator(
			set as unknown as Parameters<StateCreator<T, [], [], T>>[0],
			get as unknown as Parameters<StateCreator<T, [], [], T>>[1],
			api as unknown as Parameters<StateCreator<T, [], [], T>>[2],
		);
		const subscriptions = new Set<(state: T, prevState: T) => void>();

		const originalSet = set;
		set = ((partial: SetStateAction<T>, replace?: boolean | undefined) => {
			const prevState = get();
			originalSet(partial as Partial<T>, replace as undefined);
			const newState = get();

			subscriptions.forEach((subscription) => {
				try {
					subscription(newState as T, prevState as T);
				} catch (error) {
					console.error("Subscription error:", error);
				}
			});
		}) as typeof set;

		return {
			...store,
			subscribe: (callback: (state: T, prevState: T) => void) => {
				subscriptions.add(callback);
				return () => {
					subscriptions.delete(callback);
				};
			},
		};
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
