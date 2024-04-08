import { useCallback, useEffect, useRef } from 'react';

interface TimeoutOptions {
    callback: () => void;
    delay: number;
}

export default function useTimeout({ callback, delay }: TimeoutOptions) {
    const callbackRef = useRef<() => void>(callback);
    const timeoutRef = useRef<NodeJS.Timeout | undefined>();

    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    const set = useCallback(() => {
        timeoutRef.current = setTimeout(() => {
            callbackRef.current();
        }, delay);
    }, [delay]);

    const clear = useCallback(() => {
        if (timeoutRef.current !== undefined) {
            clearTimeout(timeoutRef.current);
        }
    }, []);

    useEffect(() => {
        set();
        return clear;
    }, [delay, set, clear]);

    const reset = useCallback(() => {
        clear();
        set();
    }, [clear, set]);

    return { reset, clear };
}
