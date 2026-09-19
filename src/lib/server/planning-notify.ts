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

const fmt = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en", { month: "short", day: "numeric" })} ${d.toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" })}`;
};

/** The item went live: tell the account behind its resource (skips self). */
export async function notifyPlanningPublished(auth: AuthCtx, item: PlanningItemLike): Promise<void> {
  try {
    if (!item.resource_id) return;
    const { data: res } = await supabaseServer
      .from("planning_resources")
      .select("account_id")
      .eq("id", item.resource_id)
      .maybeSingle();
    const to = (res as { account_id: string | null } | null)?.account_id;
    if (!to || to === auth.account_id) return;

    const when = fmt(item.start_at);
    await supabaseServer.from("inbox_messages").insert({
      recipient_account_id: to,
      sender_account_id: auth.account_id,
      tenant_id: auth.tenant_id,
      category: "system",
      subject: `You've been scheduled: ${item.title || item.type}`,
      body: `A ${item.type} has been assigned to you starting ${when}.`,
      link: "/planning",
      metadata: { source: "planning", type: "planning_published", planning_item_id: item.id, item_type: item.type },
    });
    await emitPings([{ topic: rtTopic.inbox(to) }]);
    await sendPushToAccounts(
      [to],
      {
        title: "You've been scheduled",
        body: `${item.title || item.type} — ${when}`,
        url: "/planning",
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
      subject: `Open shift taken: ${item.title || item.type}`,
      body: `${auth.username ?? "Someone"} claimed the ${item.type} starting ${when}.`,
      link: "/planning",
      metadata: { source: "planning", type: "planning_taken", planning_item_id: item.id, item_type: item.type },
    });
    await emitPings([{ topic: rtTopic.inbox(to) }]);
  } catch (e) {
    console.error("[planning-notify] taken:", e instanceof Error ? e.message : e);
  }
}
