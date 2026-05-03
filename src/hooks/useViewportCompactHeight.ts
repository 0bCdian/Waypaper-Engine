import { useSyncExternalStore } from "react";

/** Typical 1080p content area after OS chrome + window frame — reclaim space for the gallery grid */
const QUERY = "(max-height: 1080px)";

function subscribe(onStoreChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

function getServerSnapshot() {
  return false;
}

export function useViewportCompactHeight(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
