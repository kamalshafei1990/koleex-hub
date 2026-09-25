import "server-only";

/* ---------------------------------------------------------------------------
   planning-notify — inbox + push for the Planning app, in one place.

   The "you've been scheduled" notice existed twice, byte-for-byte, in the
   publish route and the item PATCH route. Both also wrote
   `metadata.type = item.type` — the PLANNING item's kind ("shift",
   "meeting"…), not a notification type — so the row never classified as
   projects_planning: its switch, its chime and its bell chip were all
   dead for planning. The item kind now travels as `item_type`; `type`
   carries what the classifier expects.

   Every helper is fire-and-forget safe.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { sendPushToAccounts } from "@/lib/server/web-push";
import { emitPings, rtTopic } from "@/lib/server/realtime-broadcast";

interface AuthCtx {
  account_id: string;
  tenant_id: string;
  username?: string | null;
}

interface PlanningItemLike {
  id: string;
  title: string | null;
  type: string;
  start_at: string;
  resource_id?: string | null;
  created_by_account_id?: string | null;
}

/* House date format (D/M/Y, 24h). The server has no idea of the reader's
   time zone, so the stamp says UTC rather than pretending to be local. The
   inbox has no i18n-key support, so copy stays short and neutral: a label,
   the item title, the stamp — no sentences to translate. */
const fmt = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
};
const itemLink = (id: string) => `/planning?item=${encodeURIComponent(id)}`;

/** The item went live: tell the account behind its resource (skips self). */
export async function notifyPlanningPublished(auth: AuthCtx, item: PlanningItemLike): Promise<void> {
  try {
    if (!item.resource_id) return;
    const { data: res } = await supabaseServer
      .from("planning_resources")
      .select("account_id")
      .eq("id", item.resource_id)
      .eq("tenant_id", auth.tenant_id)
      .maybeSingle();
    const to = (res as { account_id: string | null } | null)?.account_id;
    if (!to || to === auth.account_id) return;

    const when = fmt(item.start_at);
    await supabaseServer.from("inbox_messages").insert({
      recipient_account_id: to,
      sender_account_id: auth.account_id,
      tenant_id: auth.tenant_id,
      category: "system",
      subject: `Scheduled: ${item.title || item.type}`,
      body: `${item.title || item.type} · ${when}`,
      link: itemLink(item.id),
      metadata: { source: "planning", type: "planning_published", planning_item_id: item.id, item_type: item.type },
    });
    await emitPings([{ topic: rtTopic.inbox(to) }]);
    await sendPushToAccounts(
      [to],
      {
        title: "Scheduled",
        body: `${item.title || item.type} · ${when}`,
        url: itemLink(item.id),
        tag: `planning:${item.id}`,
        kind: "planning_published",
      },
      { actorAccountId: auth.account_id },
    );
  } catch (e) {
    console.error("[planning-notify] published:", e instanceof Error ? e.message : e);
  }
}

/** Someone claimed an open shift: tell the person who created it. */
export async function notifyPlanningTaken(auth: AuthCtx, item: PlanningItemLike): Promise<void> {
  try {
    const to = item.created_by_account_id;
    if (!to || to === auth.account_id) return;
    const when = fmt(item.start_at);
    await supabaseServer.from("inbox_messages").insert({
      recipient_account_id: to,
      sender_account_id: auth.account_id,
      tenant_id: auth.tenant_id,
      category: "system",
      subject: `Shift taken: ${item.title || item.type}`,
      body: `${auth.username ?? "—"} · ${item.title || item.type} · ${when}`,
      link: itemLink(item.id),
      metadata: { source: "planning", type: "planning_taken", planning_item_id: item.id, item_type: item.type },
    });
    await emitPings([{ topic: rtTopic.inbox(to) }]);
  } catch (e) {
    console.error("[planning-notify] taken:", e instanceof Error ? e.message : e);
  }
}
