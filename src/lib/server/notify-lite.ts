import "server-only";

/* ---------------------------------------------------------------------------
   notify-lite — tiny inbox + push notifier for modules that had no
   notification path at all (inventory transfers, low stock, quotations,
   invoices). Exists because the owner audited Settings → "By activity" and
   demanded every listed activity be REAL: each key must have at least one
   live emitter, or it is a lie in the UI.

   Fire-and-forget by contract: a notification failure must never fail the
   business mutation that triggered it. The `type` string must be
   registered in lib/notification-types.ts — its Settings switch, app and
   lifecycle live there, and validate:notification-types fails on a type
   nobody registered.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { sendPushToAccounts } from "@/lib/server/web-push";
import { emitPings, rtTopic } from "@/lib/server/realtime-broadcast";
import { superAdminAccountIds } from "@/lib/server/sa-notify";
import { clearUnreadByMeta, supersedeUnread } from "@/lib/server/inbox-lifecycle";

export async function notifyLite(opts: {
  tenantId: string | null;
  recipients: Array<string | null | undefined>;
  senderId?: string | null;
  subject: string;
  body?: string | null;
  link?: string | null;
  /** classifier-visible type — also used as the push kind */
  type: string;
  metadata?: Record<string, unknown>;
  tag?: string;
  /** The metadata that makes an older unread copy "the same information"
   *  (e.g. { transfer_id }): those copies are archived for these recipients
   *  before this one lands — its lifecycle in lib/notification-types.ts. */
  supersede?: Record<string, string>;
}): Promise<void> {
  try {
    const to = Array.from(new Set(opts.recipients.filter(Boolean) as string[]))
      .filter((id) => id !== opts.senderId);
    if (to.length === 0) return;

    if (opts.supersede) await supersedeUnread({ recipients: to, meta: opts.supersede });
    await supabaseServer.from("inbox_messages").insert(
      to.map((recipient) => ({
        recipient_account_id: recipient,
        sender_account_id: opts.senderId ?? null,
        tenant_id: opts.tenantId,
        category: "system",
        subject: opts.subject,
        body: opts.body ?? null,
        link: opts.link ?? null,
        metadata: { ...(opts.metadata ?? {}), type: opts.type },
      })),
    );
    /* Wake the recipients' bells now — without the ping the row waited for
       the 60s poll while every other producer showed up instantly. */
    await emitPings(to.map((id) => ({ topic: rtTopic.inbox(id) })));
    await sendPushToAccounts(
      to,
      {
        title: opts.subject,
        body: opts.body ?? "",
        url: opts.link ?? "/",
        tag: opts.tag ?? opts.type,
        kind: opts.type,
      },
      { actorAccountId: opts.senderId ?? null },
    );
  } catch (e) {
    console.error("[notify-lite]", opts.type, e instanceof Error ? e.message : e);
  }
}

/* Low stock is a STATE, not an event: the alert says "this item is at or
   under its minimum". It is raised after stock LEAVES a warehouse (once per
   item+warehouse per 24h so a busy shipping day doesn't spam; a newer one
   replaces an unread older one), and it is settled when stock COMES BACK
   above the minimum — otherwise the admins' bells kept shouting about
   shelves that were refilled days ago. */
async function lowStockLevel(
  tenantId: string | null,
  inventoryItemId: string,
  warehouseId: string | null,
): Promise<{ name: string | null; qty: number; threshold: number } | null> {
  const { data: item } = await supabaseServer
    .from("inventory_items")
    .select("id, name, min_stock, reorder_point, track_stock")
    .eq("id", inventoryItemId)
    .maybeSingle();
  if (!item) return null;
  const threshold = Number(item.min_stock ?? item.reorder_point ?? 0);
  if (!threshold || threshold <= 0 || item.track_stock === false) return null;

  let bq = supabaseServer
    .from("inventory_stock_balances")
    .select("qty_on_hand")
    .eq("inventory_item_id", inventoryItemId);
  if (tenantId) bq = bq.eq("tenant_id", tenantId);
  if (warehouseId) bq = bq.eq("warehouse_id", warehouseId);
  const { data: balances } = await bq;
  const qty = ((balances ?? []) as Array<{ qty_on_hand: number | null }>)
    .reduce((s, b) => s + (Number(b.qty_on_hand) || 0), 0);
  return { name: (item.name as string | null) ?? null, qty, threshold };
}

/** The alert's own scope: the item, and the warehouse when it was known. */
const lowStockKey = (inventoryItemId: string, warehouseId: string | null): Record<string, string> =>
  warehouseId
    ? { type: "low_stock_alert", item_id: inventoryItemId, warehouse_id: warehouseId }
    : { type: "low_stock_alert", item_id: inventoryItemId };

export async function checkLowStockAndNotify(
  tenantId: string | null,
  inventoryItemId: string,
  warehouseId: string | null,
  actorId: string | null,
): Promise<void> {
  try {
    const level = await lowStockLevel(tenantId, inventoryItemId, warehouseId);
    if (!level || level.qty > level.threshold) return;
    const { qty, threshold } = level;

    /* 24h dedupe per item(+warehouse). */
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { count } = await supabaseServer
      .from("inbox_messages")
      .select("id", { count: "exact", head: true })
      .eq("metadata->>type", "low_stock_alert")
      .eq("metadata->>item_id", inventoryItemId)
      .gte("created_at", since);
    if ((count ?? 0) > 0) return;

    /* The default audience for an operational alert is the tenant's Super
       Admins — the same resolution sa-notify uses (account flag OR role
       flag). A local copy here only matched the account flag, so an admin
       whose power came from the role never heard about low stock. */
    const admins = await superAdminAccountIds(tenantId);
    await notifyLite({
      tenantId,
      recipients: admins,
      senderId: actorId,
      subject: `Low stock: ${level.name ?? "item"}`,
      body: `On hand ${qty} ≤ minimum ${threshold}.`,
      link: "/inventory/items?filter=low_stock",
      type: "low_stock_alert",
      metadata: { source: "inventory", item_id: inventoryItemId, warehouse_id: warehouseId, qty, threshold },
      tag: `lowstock:${inventoryItemId}`,
      supersede: lowStockKey(inventoryItemId, warehouseId),
    });
  } catch (e) {
    console.error("[notify-lite] low-stock", e instanceof Error ? e.message : e);
  }
}

/** Stock came IN (a receipt, a transfer arriving, a voided shipment): if the
 *  item is back above its minimum there, its unread alerts are settled. */
export async function clearLowStockIfRestocked(
  tenantId: string | null,
  inventoryItemId: string,
  warehouseId: string | null,
): Promise<void> {
  try {
    /* Almost every receipt finds no open alert: one cheap read, and done. */
    const key = lowStockKey(inventoryItemId, warehouseId);
    let open = supabaseServer.from("inbox_messages").select("id", { count: "exact", head: true }).is("read_at", null);
    for (const [k, v] of Object.entries(key)) open = open.eq(`metadata->>${k}`, v);
    const { count } = await open;
    if (!count) return;
    const level = await lowStockLevel(tenantId, inventoryItemId, warehouseId);
    if (level && level.qty <= level.threshold) return;
    await clearUnreadByMeta(key);
  } catch (e) {
    console.error("[notify-lite] low-stock clear", e instanceof Error ? e.message : e);
  }
}
