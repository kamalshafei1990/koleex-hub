import "server-only";

/* ---------------------------------------------------------------------------
   inbox-resurface — bring a notification back to the top of its reader's bell.

   Two things do it: a snooze running out (the reader said "later",
   /api/cron/inbox-wake) and a request still waiting on its approver a day
   on (lib/server/approval-reminders). Either way it is the SAME row, not a
   copy: the lifecycle verbs keep settling it by its keys, a decision taken
   on it still clears it, and the bell never shows the request twice.

   What changes: created_at becomes now (it sorts first, and the bell's
   subscription sees it as new — a pop-up card), read_at is cleared, any
   snooze is over, and metadata.first_at keeps the moment the reader was
   first asked (the "Needs you" list counts the wait from it).

   Each update is a compare-and-set — on the row still being where it was
   read (the same created_at), or still being due (a snooze) — so two runs
   never bring one row back twice, and a row archived meanwhile stays put.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { emitPings, rtTopic } from "@/lib/server/realtime-broadcast";
import { sendPushToAccounts, type PushPayload } from "@/lib/server/web-push";

export type InboxRow = {
  id: string;
  tenant_id: string | null;
  recipient_account_id: string;
  subject: string;
  body: string | null;
  link: string | null;
  created_at: string;
  read_at: string | null;
  archived_at: string | null;
  snoozed_until: string | null;
  metadata: Record<string, unknown> | null;
};

export const INBOX_ROW_COLS =
  "id, tenant_id, recipient_account_id, subject, body, link, created_at, read_at, archived_at, snoozed_until, metadata";

/** When the reader was first asked (a row brought back keeps it). */
export const firstAt = (row: InboxRow): string =>
  typeof row.metadata?.first_at === "string" ? row.metadata.first_at : row.created_at;

export async function resurface(
  rows: InboxRow[],
  opts: {
    /** Metadata to add (reminder count, …). */
    meta?: (row: InboxRow) => Record<string, unknown>;
    /** The push each row sends, or null for none. */
    push: (row: InboxRow) => PushPayload | null;
    /** A snooze running out: only while the row is still snoozed and due. */
    snoozed?: boolean;
  },
): Promise<InboxRow[]> {
  const now = new Date().toISOString();
  const back: InboxRow[] = [];
  for (const row of rows) {
    let q = supabaseServer
      .from("inbox_messages")
      .update({
        created_at: now,
        read_at: null,
        snoozed_until: null,
        metadata: { ...(row.metadata ?? {}), first_at: firstAt(row), ...(opts.meta?.(row) ?? {}) },
      })
      .eq("id", row.id)
      .is("archived_at", null);
    q = opts.snoozed ? q.not("snoozed_until", "is", null).lte("snoozed_until", now) : q.eq("created_at", row.created_at);
    const { data, error } = await q.select("id").maybeSingle();
    if (error) { console.error("[inbox-resurface]", row.id, error.message); continue; }
    if (data) back.push(row);
  }
  if (back.length === 0) return back;
  /* Wake the readers' bells now; the pushes follow, a few at a time. */
  await emitPings([...new Set(back.map((r) => r.recipient_account_id))].map((id) => ({ topic: rtTopic.inbox(id) })));
  for (let i = 0; i < back.length; i += 8) {
    await Promise.all(back.slice(i, i + 8).map(async (r) => {
      const p = opts.push(r);
      if (!p) return;
      try { await sendPushToAccounts([r.recipient_account_id], p); }
      catch (e) { console.error("[inbox-resurface] push", r.id, e instanceof Error ? e.message : e); }
    }));
  }
  return back;
}
