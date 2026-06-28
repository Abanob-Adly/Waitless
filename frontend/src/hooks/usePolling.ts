import { useEffect, useRef } from "react";

/**
 * Calls `fn` on mount and then every `intervalMs` milliseconds.
 * Clears the interval on unmount or when dependencies change.
 */
export function usePolling(fn: () => void, intervalMs: number): void {
  const fnRef = useRef(fn);
  fnRef.current = fn; // always call latest version without restarting the interval

  useEffect(() => {
    fnRef.current();
    const id = setInterval(() => fnRef.current(), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}
