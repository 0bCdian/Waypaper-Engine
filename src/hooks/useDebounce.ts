import { useEffect, useRef, type DependencyList } from "react";

type Callback = () => void;

export default function useDebounce(
  callback: Callback,
  delay: number,
  dependencies: DependencyList,
): void {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    const timer = setTimeout(() => callbackRef.current(), delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, delay]);
}
