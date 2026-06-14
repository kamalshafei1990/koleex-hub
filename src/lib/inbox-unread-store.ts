/* ---------------------------------------------------------------------------
   inbox-unread-store — one shared source for the inbox unread badge.

   Both the global header NotificationBell and the UserMenu render an inbox
   unread badge. They used to each run their own 60 s `fetchUnreadCount`
   poll for the SAME account — duplicate Supabase work on every header.

   NotificationBell is the authoritative owner of the inbox count: it has
   the realtime subscription (+ chime), the 5 s grace window, the focus /
   visibilitychange resync, and the visibility-guarded poll. So rather than
   rebuild any of that, the bell stays the SINGLE poller and simply
   publishes its count here on every change; UserMenu subscribes and drops
   its own poll. The bell's behavior is untouched (publishing is additive).

   Account-scoped: the snapshot carries the accountId it belongs to, and
   the hook returns 0 for any other account, so a stale count never leaks
   across an account/session switch.
   --------------------------------------------------------------------------- */

import { useSyncExternalStore } from "react";

type InboxUnreadSnapshot = { accountId: string | null; count: number };

/* Module singleton. Replaced (never mutated) on publish so the reference
   is stable between publishes — required for useSyncExternalStore to bail
   out of redundant renders. */
let snapshot: InboxUnreadSnapshot = { accountId: null, count: 0 };
const listeners = new Set<() => void>();

/** Publish the authoritative inbox unread count for an account. Called by
 *  NotificationBell whenever its count or account changes. No-ops when the
 *  value is unchanged so subscribers don't re-render needlessly. */
export function publishInboxUnread(accountId: string | null, count: number): void {
  if (snapshot.accountId === accountId && snapshot.count === count) return;
  snapshot = { accountId, count };
  for (const listener of listeners) listener();
}

function getSnapshot(): InboxUnreadSnapshot {
  return snapshot;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Read the shared inbox unread count for `accountId`. Returns 0 unless the
 *  published snapshot belongs to the same account (prevents cross-account
 *  stale counts). The producer (NotificationBell) owns the polling; this is
 *  a pure consumer. */
export function useInboxUnread(accountId: string | null): number {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return snap.accountId === accountId ? snap.count : 0;
}
