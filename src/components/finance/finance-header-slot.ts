"use client";

/* ---------------------------------------------------------------------------
   finance-header-slot — the page tells the header what to say; the header
   lives in the segment layout and never unmounts.

   WHY. Every finance route is its own page, and the header (title, Create
   button, the tab strip) was rendered INSIDE each page. A tab click therefore
   unmounted the whole screen — header included — showed the route loader in
   its place, and rebuilt the header from scratch on the next route. That is
   what "each tab loads like I opened a new page" looks like: the strip you
   just clicked disappears and comes back.

   Now the header is mounted once, by the /finance layout, and each page only
   PUBLISHES its title, subtitle and actions here. The layout's frame reads
   them. Switching tabs changes the words in a header that stays put, and the
   route loader — when it shows at all — appears under the tabs, not instead
   of them.

   A plain module store, read through useSyncExternalStore. Not context: the
   publisher (the page) sits BELOW the reader (the layout's frame) in the
   tree, and context flows the other way.
   --------------------------------------------------------------------------- */

import { useSyncExternalStore, type ReactNode } from "react";

export type FinanceHealthStatus = "healthy" | "watch" | "stress" | "unknown";

export interface FinanceHeaderSlot {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  controls?: ReactNode;
  health?: FinanceHealthStatus;
  showTabs?: boolean;
}

let current: FinanceHeaderSlot | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Called by the page on every render (and with null on unmount). */
export function publishFinanceHeader(slot: FinanceHeaderSlot | null): void {
  current = slot;
  for (const l of listeners) l();
}

const getSnapshot = () => current;
const getServerSnapshot = () => null;

/** What the current page asked the header to show, or null between pages. */
export function useFinanceHeaderSlot(): FinanceHeaderSlot | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
