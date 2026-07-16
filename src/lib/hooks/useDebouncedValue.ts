"use client";

import { useEffect, useState } from "react";

/* Canonical debounced-value hook (Phase 4 Wave 2A.1).
   Returns `value` delayed by `delayMs`; the timer resets on each change so a
   fast-typing user only settles once. Used by useServerList so a keystroke
   does not fire one request per character. (A second copy lives in the
   Inventory module — left untouched here to avoid a cross-app change; new
   shared code should import this canonical one.) */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
