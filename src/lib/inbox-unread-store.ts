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

type InboxUnreadSnapshot = {
  accountId: string | null;
  count: number;
  /* Unread notifications per app (the Home tiles' numbers) and the count
     they were read at. The Gate publishes both from the badges it already
     reads; the real bell publishes the count alone, so a count that moved
     past `byAppAt` means these numbers are behind. */
  byApp: Record<string, number> | null;
  byAppAt: number | null;
};

/* Module singleton. Replaced (never mutated) on publish so the reference
   is stable between publishes — required for useSyncExternalStore to bail
   out of redundant renders. */
let snapshot: InboxUnreadSnapshot = { accountId: null, count: 0, byApp: null, byAppAt: null };
const listeners = new Set<() => void>();

/** Publish the authoritative inbox unread count for an account. Called by
 *  NotificationBell whenever its count or account changes. No-ops when the
 *  value is unchanged so subscribers don't re-render needlessly. */
export function publishInboxUnread(accountId: string | null, count: number, byApp?: Record<string, number>): void {
  const same = snapshot.accountId === accountId;
  if (same && snapshot.count === count && (!byApp || sameCounts(byApp, snapshot.byApp))) return;
  snapshot = byApp
    ? { accountId, count, byApp, byAppAt: count }
    : { accountId, count, byApp: same ? snapshot.byApp : null, byAppAt: same ? snapshot.byAppAt : null };
  for (const listener of listeners) listener();
}

function sameCounts(a: Record<string, number>, b: Record<string, number> | null): boolean {
  if (!b) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => a[k] === b[k]);
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

/** The Home tiles' numbers: unread notifications per app for `accountId`,
 *  and whether they still match the unread count (`fresh`). `published` is
 *  false until anything was published for this account — nothing to fetch
 *  yet, the Gate's first read is on its way. */
export function useInboxUnreadByApp(accountId: string | null): {
  byApp: Record<string, number>;
  count: number;
  fresh: boolean;
  published: boolean;
} {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const mine = snap.accountId === accountId && accountId !== null;
  return {
    byApp: (mine && snap.byApp) || EMPTY,
    count: mine ? snap.count : 0,
    fresh: mine && snap.byAppAt === snap.count,
    published: mine,
  };
}
const EMPTY: Record<string, number> = {};
