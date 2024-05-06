import { useEffect, useRef } from 'react';

type callback = (...args: any[]) => void;

function useDebounceCallback(callback: callback, delay = 500) {
    const timeoutRef = useRef<{ id: null | NodeJS.Timeout }>({ id: null });

    useEffect(() => {
        return () => {
            // Clean up the timeout when the component unmounts
            if (timeoutRef.current.id !== null) {
                clearTimeout(timeoutRef.current.id);
            }
        };
    }, []);
    return function debouncedCallback(...args: any[]) {
        // Clear the previous timeout if it exists
        if (timeoutRef.current.id !== null) {
            clearTimeout(timeoutRef.current.id);
        }

        // Set a new timeout with the specified delay
        timeoutRef.current.id = setTimeout(() => {
            // Call the original callback with the provided arguments
            callback(args);
            timeoutRef.current.id = null;
        }, delay);
    };
}

export default useDebounceCallback;
