"use client";

/* ---------------------------------------------------------------------------
   AppHeaderSlot — lets an app merge its own header INTO the global MainHeader
   instead of stacking a second 56px band under it (approved 2026-07-17,
   Discuss Step 1: the two look-alike bars read as "nothing changed").

   Pattern mirrors SidebarContext: a provider wraps the shell; MainHeader
   READS via useAppHeader(); the app WRITES via useSetAppHeader(content).
   Content null → MainHeader behaves exactly as before, so the other apps
   are untouched.

   Stability contract for writers: useMemo the content object and useCallback
   its handlers — the setter effect re-fires only when the memo identity
   changes, and the slot is cleared automatically on unmount.
   --------------------------------------------------------------------------- */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export interface AppHeaderContent {
  title: ReactNode;
  subtitle?: ReactNode;
  avatar?: ReactNode;
  onBack?: () => void;
  actions?: ReactNode;
}

const ReadCtx = createContext<AppHeaderContent | null>(null);
const WriteCtx = createContext<(c: AppHeaderContent | null) => void>(() => {});

export function AppHeaderProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<AppHeaderContent | null>(null);
  return (
    <WriteCtx.Provider value={setContent}>
      <ReadCtx.Provider value={content}>{children}</ReadCtx.Provider>
    </WriteCtx.Provider>
  );
}

/** MainHeader reads the current slot (null = no app header registered). */
export function useAppHeader(): AppHeaderContent | null {
  return useContext(ReadCtx);
}

/** Apps register their header content; pass null to release the slot.
 *  Cleared automatically on unmount. */
export function useSetAppHeader(content: AppHeaderContent | null): void {
  const set = useContext(WriteCtx);
  useEffect(() => {
    set(content);
    return () => set(null);
  }, [set, content]);
}
