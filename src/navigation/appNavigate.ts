import type { NavigateFunction, NavigateOptions } from "react-router-dom";

let navigateFn: NavigateFunction | undefined;

export function setAppNavigate(fn: NavigateFunction | undefined): void {
  navigateFn = fn;
}

/** Imperative navigate for non-component callers (e.g. context menus). */
export function appNavigate(to: string, opts?: NavigateOptions): void {
  if (!navigateFn) return;
  navigateFn(to, opts);
}
