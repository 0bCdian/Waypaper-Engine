/**
 * Store Hooks for Waypaper Engine
 *
 * Custom hooks for working with Zustand stores.
 */

import { useEffect, useRef } from "react";
import type { StoreApi, UseBoundStore } from "zustand";

/**
 * Hook for selecting from store with shallow comparison
 */
export function useStoreSelector<T, R>(
	store: UseBoundStore<StoreApi<T>>,
	selector: (state: T) => R,
): R {
	return store(selector);
}

/**
 * Hook for getting store actions
 */
export function useStoreAction<T, R>(
	store: UseBoundStore<StoreApi<T>>,
	action: (state: T) => R,
): R {
	return store(action);
}

/**
 * Hook for subscribing to store changes
 */
export function useStoreSubscription<T, R>(
	store: UseBoundStore<StoreApi<T>>,
	selector: (state: T) => R,
	callback: (value: R, prevValue: R | undefined) => void,
	equalityFn?: (a: R, b: R | undefined) => boolean,
): void {
	const prevValueRef = useRef<R | undefined>(undefined);

	useEffect(() => {
		const unsubscribe = store.subscribe((state) => {
			const value = selector(state);
			const prevValue = prevValueRef.current;

			if (equalityFn ? !equalityFn(value, prevValue) : value !== prevValue) {
				callback(value, prevValue);
				prevValueRef.current = value;
			}
		});

		return unsubscribe;
	}, [store, selector, callback, equalityFn]);
}

/**
 * Hook for debounced store updates
 */
export function useDebouncedStoreUpdate<T>(
	store: UseBoundStore<StoreApi<T>>,
	delay: number = 300,
) {
	const timeoutRef = useRef<NodeJS.Timeout>(undefined);

	return (updater: (state: T) => Partial<T>) => {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
		}

		timeoutRef.current = setTimeout(() => {
			store.setState(updater);
		}, delay);
	};
}

/**
 * Hook for throttled store updates
 */
export function useThrottledStoreUpdate<T>(
	store: UseBoundStore<StoreApi<T>>,
	delay: number = 100,
) {
	const lastUpdateRef = useRef<number>(0);

	return (updater: (state: T) => Partial<T>) => {
		const now = Date.now();

		if (now - lastUpdateRef.current >= delay) {
			lastUpdateRef.current = now;
			store.setState(updater);
		}
	};
}

/**
 * Hook for store persistence
 */
export function useStorePersistence<T>(
	store: UseBoundStore<StoreApi<T>>,
	key: string,
	version: number = 1,
) {
	useEffect(() => {
		// Load from localStorage
		try {
			const stored = localStorage.getItem(key);
			if (stored) {
				const parsed = JSON.parse(stored);
				if (parsed.version === version) {
					store.setState(parsed.state);
				}
			}
		} catch (error) {
			console.error("Failed to load store from localStorage:", error);
		}

		// Save to localStorage on changes
		const unsubscribe = store.subscribe((state) => {
			try {
				localStorage.setItem(
					key,
					JSON.stringify({
						state,
						version,
						timestamp: Date.now(),
					}),
				);
			} catch (error) {
				console.error("Failed to save store to localStorage:", error);
			}
		});

		return unsubscribe;
	}, [store, key, version]);
}

/**
 * Hook for store validation
 */
export function useStoreValidation<T>(
	store: UseBoundStore<StoreApi<T>>,
	validator: (state: T) => boolean,
	onError?: (error: string) => void,
) {
	useEffect(() => {
		const unsubscribe = store.subscribe((state) => {
			if (!validator(state)) {
				const error = "Store validation failed";
				console.error(error, state);
				onError?.(error);
			}
		});

		return unsubscribe;
	}, [store, validator, onError]);
}

/**
 * Hook for store debugging
 */
export function useStoreDebug<T>(
	store: UseBoundStore<StoreApi<T>>,
	name: string,
	enabled: boolean = process.env.NODE_ENV === "development",
) {
	useEffect(() => {
		if (!enabled) return;

		const unsubscribe = store.subscribe((state, prevState) => {
			console.group(`🔄 ${name} Store Update`);
			console.log("Previous:", prevState);
			console.log("Current:", state);
			console.groupEnd();
		});

		return unsubscribe;
	}, [store, name, enabled]);
}

/**
 * Hook for store performance monitoring
 */
export function useStorePerformance<T>(
	store: UseBoundStore<StoreApi<T>>,
	name: string,
	threshold: number = 10, // ms
) {
	useEffect(() => {
		if (process.env.NODE_ENV !== "development") return;

		const unsubscribe = store.subscribe((_state, _prevState) => {
			const start = performance.now();

			// Simulate some work to measure
			requestAnimationFrame(() => {
				const end = performance.now();

				if (end - start > threshold) {
					console.warn(`⚠️ Slow store update in ${name}: ${end - start}ms`);
				}
			});
		});

		return unsubscribe;
	}, [store, name, threshold]);
}

/**
 * Hook for store error handling
 */
export function useStoreErrorHandling<T>(
	store: UseBoundStore<StoreApi<T>>,
	onError?: (error: Error) => void,
) {
	useEffect(() => {
		const originalSetState = store.setState;

		store.setState = ((
			partial: T | Partial<T> | ((state: T) => T | Partial<T>),
			replace?: boolean | undefined,
		) => {
			try {
				return originalSetState(partial, replace);
			} catch (error) {
				const err =
					error instanceof Error ? error : new Error("Unknown store error");
				console.error("Store error:", err);
				onError?.(err);
				throw err;
			}
		}) as typeof store.setState;

		return () => {
			store.setState = originalSetState;
		};
	}, [store, onError]);
}

export default {
	useStoreSelector,
	useStoreAction,
	useStoreSubscription,
	useDebouncedStoreUpdate,
	useThrottledStoreUpdate,
	useStorePersistence,
	useStoreValidation,
	useStoreDebug,
	useStorePerformance,
	useStoreErrorHandling,
};
