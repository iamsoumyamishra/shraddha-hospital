import * as React from "react";

const MOBILE_BREAKPOINT = 768;

function subscribe(callback: () => void): () => void {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getSnapshot(): boolean {
  return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches;
}

/** Server render assumes desktop, so the first client paint has no hydration mismatch. */
function getServerSnapshot(): boolean {
  return false;
}

/**
 * `useSyncExternalStore` rather than an effect plus state: the media query is an
 * external system, so subscribing to it is what this hook is for. Seeding state
 * inside the effect body triggered a cascading render on every mount.
 */
export function useIsMobile(): boolean {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}