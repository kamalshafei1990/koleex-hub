"use client";
/* inbox-warm — the notification lists, painted from the last answer.

   The bell's panel opened in 18 ms but its rows waited for the network:
   500 ms on a good moment, 1.2 s on a bad one (measured on production,
   26/09/2026 — the server answers in ~70 ms of database time, the rest is the
   path to it). Nothing about the request can be trimmed further, so the only
   lever is not to wait for it: keep the last list, show it the instant the
   panel opens, refresh underneath. Same for the mailbox page.

   Rules this file carries:
   · warm-cache (localStorage), NOT IndexedDB — the read has to be
     synchronous, in a useState initialiser, or the rows land after the first
     frame and the panel jumps (the standing no-shift rule; warm-cache.ts
     explains the choice).
   · SCOPED. Each entry records the account AND currentScopeKey(), and is only
     read or written under the caller's own ":self" scope. During a Super
     Admin "view as" the server answers for the viewed account while the
     local account id stays the admin's — a list cached then would reappear
     as the admin's own after exit. So view-as never touches these entries.
   · Keys live under warm-cache's `kx:` prefix, which sign-out wipes. */
import { readWarm, writeWarm, warmAge } from "@/lib/warm-cache";
import { currentScopeKey } from "@/lib/me-bootstrap";
import type { InboxMessageWithSender } from "@/types/supabase";

/** The bell's one request: slim rows, the whole feed (see NotificationBell). */
export const BELL_FEED_URL = "/api/inbox/feed?resource=messages&limit=300&slim=1";

const BELL_KEY = "inbox:bell:v1";
const MAIL_KEY = "inbox:mail:v1";
/* A day's gap is normal — the Hub is opened each morning. Yesterday's list
   for 300 ms beats a spinner, and every open refreshes it. */
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

type Entry = { accountId: string; scope: string; rows: InboxMessageWithSender[] };

function ownScope(): string | null {
  const s = currentScopeKey();
  return s.endsWith(":self") ? s : null;
}

function read(key: string, accountId: string | null): InboxMessageWithSender[] | null {
  if (!accountId) return null;
  const scope = ownScope();
  if (!scope) return null;
  const e = readWarm<Entry>(key, MAX_AGE_MS);
  return e && e.accountId === accountId && e.scope === scope && Array.isArray(e.rows) ? e.rows : null;
}

function write(key: string, accountId: string | null, rows: InboxMessageWithSender[]): void {
  if (!accountId) return;
  const scope = ownScope();
  if (!scope) return;
  writeWarm<Entry>(key, { accountId, scope, rows });
}

export const readWarmBellFeed = (accountId: string | null) => read(BELL_KEY, accountId);
export const writeWarmBellFeed = (accountId: string | null, rows: InboxMessageWithSender[]) => write(BELL_KEY, accountId, rows);
export const readWarmMailFeed = (accountId: string | null) => read(MAIL_KEY, accountId);
export const writeWarmMailFeed = (accountId: string | null, rows: InboxMessageWithSender[]) => write(MAIL_KEY, accountId, rows);

/** Fetch the bell's list ahead of the first press, so that press paints rows
 *  instead of a spinner. Skipped when a fresh answer is already stored
 *  (under `minAgeMs`), and a failure is silent — the bell fetches on open
 *  anyway. Pass `force` when the unread count moved: the stored list is known
 *  to be behind. */
export async function prewarmBellFeed(accountId: string | null, opts: { force?: boolean; minAgeMs?: number } = {}): Promise<void> {
  if (!accountId || !ownScope()) return;
  if (!opts.force && warmAge(BELL_KEY) < (opts.minAgeMs ?? 60_000)) return;
  try {
    const res = await fetch(BELL_FEED_URL, { credentials: "include", cache: "no-store" });
    if (!res.ok) return;
    const j = (await res.json()) as { ok?: boolean; data?: InboxMessageWithSender[] };
    if (j?.ok && Array.isArray(j.data)) writeWarmBellFeed(accountId, j.data);
  } catch { /* the open fetches for itself */ }
}
