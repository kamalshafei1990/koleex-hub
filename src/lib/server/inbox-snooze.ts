import "server-only";

/* ---------------------------------------------------------------------------
   inbox-snooze — "Later" on a notification, and waking it.

   A snoozed row stays UNREAD but is hidden — from the bell, the center's
   views and every unread count — until snoozed_until. Staying unread keeps
   it inside the lifecycle: if its cause is settled meanwhile (the task done,
   the request decided), the verbs archive it like any other unread copy and
   it never comes back.

   The wake cron (/api/cron/inbox-wake, every 5 minutes) brings each due row
   back to the top as new (lib/server/inbox-resurface) and sends its push —
   a row settled meanwhile only loses its snooze, silently.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { INBOX_ROW_COLS, resurface, type InboxRow } from "@/lib/server/inbox-resurface";
import { readTpl } from "@/lib/notification-templates";

/** The furthest a notification can be put off. */
export const SNOOZE_MAX_MS = 30 * 86_400_000;

const typeOf = (m: Record<string, unknown> | null) =>
  (typeof m?.type === "string" && m.type) || (typeof m?.kind === "string" && m.kind) || undefined;

export async function wakeSnoozed(now: Date = new Date()): Promise<{ woke: number; dropped: number }> {
  const { data, error } = await supabaseServer
    .from("inbox_messages")
    .select(INBOX_ROW_COLS)
    .not("snoozed_until", "is", null)
    .lte("snoozed_until", now.toISOString())
    .order("snoozed_until", { ascending: true })
    .limit(300);
  if (error) { console.error("[inbox-snooze] read:", error.message); return { woke: 0, dropped: 0 }; }
  const rows = (data ?? []) as unknown as InboxRow[];
  const live = rows.filter((r) => !r.archived_at && !r.read_at);
  const settled = rows.filter((r) => r.archived_at || r.read_at).map((r) => r.id);
  if (settled.length) {
    const { error: e } = await supabaseServer.from("inbox_messages").update({ snoozed_until: null }).in("id", settled);
    if (e) console.error("[inbox-snooze] drop:", e.message);
  }
  const back = await resurface(live, {
    snoozed: true,
    push: (r) => ({
      title: r.subject,
      body: r.body ?? "",
      url: r.link ?? "/",
      tag: `later:${r.id}`,
      kind: typeOf(r.metadata),
      tpl: readTpl(r.metadata),
    }),
  });
  return { woke: back.length, dropped: settled.length };
}
