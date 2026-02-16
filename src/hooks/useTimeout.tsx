import { useEffect, useRef } from "react";

interface TimeoutOptions {
	callback: () => void;
	delay: number;
}

export default function useTimeout({ callback, delay }: TimeoutOptions) {
	const callbackRef = useRef<() => void>(callback);
	const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

	useEffect(() => {
		callbackRef.current = callback;
	}, [callback]);

	const set = () => {
		timeoutRef.current = setTimeout(() => {
			callbackRef.current();
		}, delay);
	};

	const clear = () => {
		if (timeoutRef.current !== undefined) {
			clearTimeout(timeoutRef.current);
		}
	};

	useEffect(() => {
		set();
		return clear;
	}, [delay]);

	const reset = () => {
		clear();
		set();
	};

	return { reset, clear };
}
