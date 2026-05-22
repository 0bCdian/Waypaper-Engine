import { useCallback, useEffect, useRef } from "react";

type callback = (...args: unknown[]) => void;

function useDebounceCallback(callback: callback, delay = 500) {
  const timeoutRef = useRef<{ id: null | NodeJS.Timeout }>({ id: null });
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    return () => {
      if (timeoutRef.current.id !== null) {
        clearTimeout(timeoutRef.current.id);
      }
    };
  }, []);

  return useCallback(
    (...args: unknown[]) => {
      if (timeoutRef.current.id !== null) {
        clearTimeout(timeoutRef.current.id);
      }

      timeoutRef.current.id = setTimeout(() => {
        callbackRef.current(...args);
        timeoutRef.current.id = null;
      }, delay);
    },
    [delay],
  );
}

export default useDebounceCallback;
