import "server-only";

import { supabaseServer } from "@/lib/server/supabase-server";

/* ---------------------------------------------------------------------------
   inbox-lifecycle — the two verbs every notification writer owes the inbox.

   The 2026-08-21 debug session measured what happens without them: the
   owner's bell said "30 new" over a panel shouting "All 99+", one recurring
   task had been notified THIRTY-ONE times (daily since creation), and the
   audit counted 28 writers against ZERO clearers. A notification system in
   which things only ever get louder is not informing anyone.

   Two verbs, one rule each:

   · supersedeUnread — for RECURRING information (reminders, daily spawns,
     repeated security events). The new copy REPLACES an unread older one;
     a copy the user already read is history and stays untouched. Call it
     immediately before the insert, with the same recipients and the key
     that identifies "the same information".

   · clearUnreadByMeta — for ENTITY-STATE notifications (this task, this
     request, this item). When the entity reaches the state the notification
     was nagging about — completed, approved, deleted — its unread rows are
     finished business for EVERY recipient. Call it from the resolving
     handler.

   Both are best-effort by design: a failed cleanup must never fail the
   action that triggered it. Both mark read AND archived: read so badges
   drop, archived so the list stops showing them.
   --------------------------------------------------------------------------- */

type Meta = Record<string, string>;

/** Archive unread copies of the SAME information before writing a new one. */
export async function supersedeUnread(opts: {
  recipients: string[];
  category?: string;
  subject?: string;
  /** metadata equality filters, e.g. { type: "calendar_reminder", event_id } */
  meta?: Meta;
}): Promise<void> {
  if (opts.recipients.length === 0) return;
  try {
    const now = new Date().toISOString();
    let q = supabaseServer
      .from("inbox_messages")
      .update({ read_at: now, archived_at: now })
      .in("recipient_account_id", opts.recipients)
      .is("read_at", null);
    if (opts.category) q = q.eq("category", opts.category);
    if (opts.subject) q = q.eq("subject", opts.subject);
    for (const [k, v] of Object.entries(opts.meta ?? {})) {
      q = q.eq(`metadata->>${k}`, v);
    }
    const { error } = await q;
    if (error) console.error("[inbox-lifecycle] supersede:", error.message);
  } catch (e) {
    console.error("[inbox-lifecycle] supersede:", e);
  }
}

/** The entity resolved — its unread notifications are finished business. */
export async function clearUnreadByMeta(meta: Meta): Promise<void> {
  const entries = Object.entries(meta);
  if (entries.length === 0) return; /* never mass-archive on an empty filter */
  try {
    const now = new Date().toISOString();
    let q = supabaseServer
      .from("inbox_messages")
      .update({ read_at: now, archived_at: now })
      .is("read_at", null);
    for (const [k, v] of entries) q = q.eq(`metadata->>${k}`, v);
    const { error } = await q;
    if (error) console.error("[inbox-lifecycle] clear:", error.message);
  } catch (e) {
    console.error("[inbox-lifecycle] clear:", e);
  }
}
