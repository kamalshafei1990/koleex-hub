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
import { clearUnreadByMetaIn, settleListedItems } from "@/lib/server/inbox-lifecycle";
import { prepareTpl, type NotifTpl } from "@/lib/notification-templates";

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
   time zone, so the stamp says UTC rather than pretending to be local. Copy
   stays short: a label, the item title, the stamp — each notice is also
   stored as a template (notif-templates/work.ts) so it reads in the
   reader's language. */
const fmt = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
};
const itemLink = (id: string) => `/planning?item=${encodeURIComponent(id)}`;

/** "Scheduled: …" for one item: its title (a person's words), or — when it
 *  has none — its kind, which every language names (enum.planningItemType). */
const publishedTpl = (item: PlanningItemLike): NotifTpl =>
  item.title
    ? { k: "planning_published", p: { title: item.title, when: fmt(item.start_at) } }
    : { k: "planning_published.untitled", p: { itemType: item.type, when: fmt(item.start_at) } };

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
    const text = prepareTpl(publishedTpl(item));
    await supabaseServer.from("inbox_messages").insert({
      recipient_account_id: to,
      sender_account_id: auth.account_id,
      tenant_id: auth.tenant_id,
      category: "system",
      subject: text.subject,
      body: text.body ?? `${item.title || item.type} · ${when}`,
      link: itemLink(item.id),
      metadata: {
        source: "planning", type: "planning_published", planning_item_id: item.id, item_type: item.type,
        ...(text.tpl ? { tpl: text.tpl } : {}),
      },
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
        tpl: text.tpl,
      },
      { actorAccountId: auth.account_id },
    );
  } catch (e) {
    console.error("[planning-notify] published:", e instanceof Error ? e.message : e);
  }
}

/** These published items no longer stand as announced — cancelled, back to
 *  draft, completed, moved to someone else, or deleted. Pass each with the
 *  resource it was published FOR: that person's unopened "Scheduled" notice
 *  is settled (a one-item notice archived; a week notice drops these items
 *  and is archived once empty). */
export async function settlePlanningPublished(
  tenantId: string,
  items: Array<{ id: string; resource_id: string | null }>,
): Promise<void> {
  try {
    const ids = items.map((i) => i.id);
    if (ids.length === 0) return;
    await clearUnreadByMetaIn({ type: "planning_published" }, "planning_item_id", ids);
    const resIds = [...new Set(items.map((i) => i.resource_id).filter((x): x is string => !!x))];
    if (resIds.length === 0) return;
    const { data: res } = await supabaseServer
      .from("planning_resources")
      .select("account_id")
      .eq("tenant_id", tenantId)
      .in("id", resIds);
    const recipients = [...new Set(((res ?? []) as Array<{ account_id: string | null }>).map((r) => r.account_id).filter((x): x is string => !!x))];
    if (recipients.length === 0) return;
    await settleListedItems({ type: "planning_published", listKey: "planning_item_ids", items: ids, recipients });
  } catch (e) {
    console.error("[planning-notify] settle:", e instanceof Error ? e.message : e);
  }
}

/** A published item stops standing as announced when it leaves "published"
 *  or moves to another resource. */
export const leftPublished = (
  before: { status: string; resource_id: string | null },
  after: { status?: unknown; resource_id?: unknown },
): boolean => before.status === "published" && (after.status !== "published" || after.resource_id !== before.resource_id);

/** Someone claimed an open shift: tell the person who created it. */
export async function notifyPlanningTaken(auth: AuthCtx, item: PlanningItemLike): Promise<void> {
  try {
    const to = item.created_by_account_id;
    if (!to || to === auth.account_id) return;
    const when = fmt(item.start_at);
    const actor = auth.username ?? "—";
    const text = prepareTpl(
      item.title
        ? { k: "planning_taken", p: { actor, title: item.title, when } }
        : { k: "planning_taken.untitled", p: { actor, itemType: item.type, when } },
    );
    await supabaseServer.from("inbox_messages").insert({
      recipient_account_id: to,
      sender_account_id: auth.account_id,
      tenant_id: auth.tenant_id,
      category: "system",
      subject: text.subject,
      body: text.body ?? `${actor} · ${item.title || item.type} · ${when}`,
      link: itemLink(item.id),
      metadata: {
        source: "planning", type: "planning_taken", planning_item_id: item.id, item_type: item.type,
        ...(text.tpl ? { tpl: text.tpl } : {}),
      },
    });
    await emitPings([{ topic: rtTopic.inbox(to) }]);
  } catch (e) {
    console.error("[planning-notify] taken:", e instanceof Error ? e.message : e);
  }
}

/** Publish-week: ONE grouped notice per person, whatever the item count.
 *  Items without a resource, and the publisher's own items, notify no one. */
export async function notifyPlanningPublishedBatch(auth: AuthCtx, items: PlanningItemLike[]): Promise<void> {
  try {
    const resIds = [...new Set(items.map((i) => i.resource_id).filter((x): x is string => !!x))];
    if (resIds.length === 0) return;
    const { data: res } = await supabaseServer
      .from("planning_resources")
      .select("id, account_id")
      .eq("tenant_id", auth.tenant_id)
      .in("id", resIds);
    const accountByRes = new Map(
      ((res ?? []) as Array<{ id: string; account_id: string | null }>).map((r) => [r.id, r.account_id]),
    );
    const byAccount = new Map<string, PlanningItemLike[]>();
    for (const it of items) {
      const to = it.resource_id ? accountByRes.get(it.resource_id) : null;
      if (!to || to === auth.account_id) continue;
      const arr = byAccount.get(to) ?? [];
      arr.push(it);
      byAccount.set(to, arr);
    }
    if (byAccount.size === 0) return;

    const MAX_LINES = 12;
    const rows = [...byAccount.entries()].map(([to, list]) => {
      const sorted = [...list].sort((a, b) => a.start_at.localeCompare(b.start_at));
      const lines = sorted.slice(0, MAX_LINES).map((i) => `${i.title || i.type} · ${fmt(i.start_at)}`);
      if (sorted.length > MAX_LINES) lines.push(`+${sorted.length - MAX_LINES}`);
      /* One item reads exactly like the single notice (same subject, and its
         one line IS that notice's body); several keep the list as the
         stored body — it is data. */
      const text = prepareTpl(
        sorted.length === 1 ? publishedTpl(sorted[0]) : { k: "planning_published.many", p: { count: sorted.length } },
      );
      return {
        to,
        count: sorted.length,
        tpl: text.tpl,
        link: sorted.length === 1 ? itemLink(sorted[0].id) : "/planning",
        row: {
          recipient_account_id: to,
          sender_account_id: auth.account_id,
          tenant_id: auth.tenant_id,
          category: "system",
          subject: text.subject,
          body: text.body ?? lines.join("\n"),
          link: sorted.length === 1 ? itemLink(sorted[0].id) : "/planning",
          metadata: {
            source: "planning",
            type: "planning_published",
            planning_item_ids: sorted.map((i) => i.id),
            count: sorted.length,
            ...(text.tpl ? { tpl: text.tpl } : {}),
          },
        },
      };
    });

    const { error } = await supabaseServer.from("inbox_messages").insert(rows.map((r) => r.row));
    if (error) throw new Error(error.message);
    await emitPings(rows.map((r) => ({ topic: rtTopic.inbox(r.to) })));
    await Promise.all(
      rows.map((r) =>
        sendPushToAccounts(
          [r.to],
          {
            title: "Scheduled",
            /* The shifts themselves (titles and D/M/Y times — the same in
               every language), not the subject again: in zh/ar the title
               comes from the template, and repeating the English subject
               under it said nothing new, in the wrong language. */
            body: r.row.body,
            url: r.link,
            tag: `planning:week:${r.to}`,
            kind: "planning_published",
            tpl: r.tpl,
          },
          { actorAccountId: auth.account_id },
        ),
      ),
    );
  } catch (e) {
    console.error("[planning-notify] published batch:", e instanceof Error ? e.message : e);
  }
}
