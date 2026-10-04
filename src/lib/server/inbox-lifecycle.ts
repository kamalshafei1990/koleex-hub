import "server-only";

import { supabaseServer } from "@/lib/server/supabase-server";

/* ---------------------------------------------------------------------------
   inbox-lifecycle — the verbs every notification writer owes the inbox.

   The 2026-08-21 debug session measured what happens without them: the
   owner's bell said "30 new" over a panel shouting "All 99+", one recurring
   task had been notified THIRTY-ONE times (daily since creation), and the
   audit counted 28 writers against ZERO clearers. A notification system in
   which things only ever get louder is not informing anyone.

   The verbs, one rule each:

   · supersedeUnread — for RECURRING information (reminders, daily spawns,
     repeated security events). The new copy REPLACES an unread older one;
     a copy the user already read is history and stays untouched. Call it
     immediately before the insert, with the same recipients and the key
     that identifies "the same information".

   · clearUnreadByMeta — for ENTITY-STATE notifications (this task, this
     request, this item). When the entity reaches the state the notification
     was nagging about — completed, approved, deleted — its unread rows are
     finished business for EVERY recipient. Call it from the resolving
     handler. clearUnreadByMetaIn is the same for many entities at once.

   · settleListedItems — for ONE row about SEVERAL things (a reminder
     listing three reports). A finished thing leaves the row's list; the row
     is archived only when its list is empty.

   Which verb each notification type owes is declared in
   lib/notification-types.ts (its `lifecycle`).

   All are best-effort by design: a failed cleanup must never fail the
   action that triggered it. All mark read AND archived: read so badges
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
  await archiveUnread(entries, null);
}

/** clearUnreadByMeta for MANY entities at once (a bulk close, a device
 *  import): `meta` narrows, and the row's `key` is any of `values`. Chunked,
 *  so a long id list never outgrows the request URL. */
export async function clearUnreadByMetaIn(meta: Meta, key: string, values: string[]): Promise<void> {
  const ids = Array.from(new Set(values.filter(Boolean)));
  if (ids.length === 0) return; /* an empty list clears nothing, never everything */
  for (let i = 0; i < ids.length; i += 100) {
    await archiveUnread(Object.entries(meta), { key, values: ids.slice(i, i + 100) });
  }
}

/** For ONE notification that covers SEVERAL things (one reminder for three
 *  reports, one "Scheduled" notice for a week of shifts): `items` are
 *  finished — drop them from each unread row's `listKey` array, and archive
 *  a row once nothing is left in it. A row still listing unfinished things
 *  stays unread: it is still true about those.
 *
 *  One item is found by JSON containment wherever it was sent. Several at
 *  once need `recipients` (the people those items were sent to): their
 *  unread rows of `type` are read and matched here. An object item matches
 *  a list element carrying all of its fields. */
export async function settleListedItems(opts: {
  type: string;
  listKey: string;
  items: Array<string | Meta>;
  recipients?: string[];
}): Promise<void> {
  if (opts.items.length === 0) return;
  if (opts.items.length > 1 && !opts.recipients?.length) return;
  try {
    let q = supabaseServer
      .from("inbox_messages")
      .select("id, metadata")
      .is("read_at", null)
      .eq("metadata->>type", opts.type);
    if (opts.recipients?.length) q = q.in("recipient_account_id", opts.recipients);
    if (opts.items.length === 1) q = q.contains("metadata", { [opts.listKey]: [opts.items[0]] });
    const { data, error } = await q.limit(200);
    if (error) { console.error("[inbox-lifecycle] settle read:", error.message); return; }
    const done = (x: unknown) => opts.items.some((it) =>
      typeof it === "string"
        ? x === it
        : !!x && typeof x === "object" && Object.entries(it).every(([k, v]) => (x as Meta)[k] === v));
    const now = new Date().toISOString();
    await Promise.all(((data ?? []) as Array<{ id: string; metadata: Record<string, unknown> | null }>).map(async (row) => {
      const list = row.metadata?.[opts.listKey];
      if (!Array.isArray(list)) return;
      const left = list.filter((x) => !done(x));
      if (left.length === list.length) return;
      const { error: upErr } = await supabaseServer
        .from("inbox_messages")
        .update(left.length === 0 ? { read_at: now, archived_at: now } : { metadata: { ...row.metadata, [opts.listKey]: left } })
        .eq("id", row.id)
        .is("read_at", null);
      if (upErr) console.error("[inbox-lifecycle] settle:", upErr.message);
    }));
  } catch (e) {
    console.error("[inbox-lifecycle] settle:", e);
  }
}

async function archiveUnread(entries: Array<[string, string]>, anyOf: { key: string; values: string[] } | null): Promise<void> {
  try {
    const now = new Date().toISOString();
    let q = supabaseServer
      .from("inbox_messages")
      .update({ read_at: now, archived_at: now })
      .is("read_at", null);
    for (const [k, v] of entries) q = q.eq(`metadata->>${k}`, v);
    if (anyOf) q = q.in(`metadata->>${anyOf.key}`, anyOf.values);
    const { error } = await q;
    if (error) console.error("[inbox-lifecycle] clear:", error.message);
  } catch (e) {
    console.error("[inbox-lifecycle] clear:", e);
  }
}
