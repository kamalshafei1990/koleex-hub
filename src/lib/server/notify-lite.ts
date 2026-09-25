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
import { prepareTpl, type NotifTpl } from "@/lib/notification-templates";
import { isLowStock, lowStockThreshold, type LowStockThreshold } from "@/lib/inventory/low-stock";

export async function notifyLite(opts: {
  tenantId: string | null;
  recipients: Array<string | null | undefined>;
  senderId?: string | null;
  /** What was said, rendered in each reader's language (notification-
   *  templates); the stored subject — and body, when the template has one —
   *  are its English. Pass `subject` only for a row with no template. */
  tpl?: NotifTpl;
  subject?: string;
  /** The stored body when the template has none (data, a person's words). */
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

    const text = opts.tpl ? prepareTpl(opts.tpl) : null;
    const subject = text?.subject ?? opts.subject ?? "";
    const body = text?.body ?? opts.body ?? null;
    if (opts.supersede) await supersedeUnread({ recipients: to, meta: opts.supersede });
    await supabaseServer.from("inbox_messages").insert(
      to.map((recipient) => ({
        recipient_account_id: recipient,
        sender_account_id: opts.senderId ?? null,
        tenant_id: opts.tenantId,
        category: "system",
        subject,
        body,
        link: opts.link ?? null,
        metadata: { ...(opts.metadata ?? {}), type: opts.type, ...(text?.tpl ? { tpl: text.tpl } : {}) },
      })),
    );
    /* Wake the recipients' bells now — without the ping the row waited for
       the 60s poll while every other producer showed up instantly. */
    await emitPings(to.map((id) => ({ topic: rtTopic.inbox(id) })));
    await sendPushToAccounts(
      to,
      {
        title: subject,
        body: body ?? "",
        url: opts.link ?? "/",
        tag: opts.tag ?? opts.type,
        kind: opts.type,
        tpl: text?.tpl,
      },
      { actorAccountId: opts.senderId ?? null },
    );
  } catch (e) {
    console.error("[notify-lite]", opts.type, e instanceof Error ? e.message : e);
  }
}

/* Low stock is a STATE, not an event: the alert says "this item is at or
   under its low-stock line". It is raised after stock LEAVES a warehouse
   (once per item+warehouse per 24h so a busy shipping day doesn't spam; a
   newer one replaces an unread older one), and it is settled when stock
   COMES BACK above the line — otherwise the admins' bells kept shouting
   about shelves that were refilled days ago.

   The line is the ONE rule the dashboard and the Items list use
   (lib/inventory/low-stock: the reorder point, else the minimum). The read
   used to ask for a `name` column the items table does not have (it is
   item_name): it failed, came back empty, and the alert never fired. A
   failed read now says so in the log and counts as "unknown" — never as
   "not low", so it neither raises an alert nor settles one. */
type LowStockLevel = { name: string | null; qty: number; threshold: number; by: LowStockThreshold["by"]; low: boolean };

async function lowStockLevel(
  tenantId: string | null,
  inventoryItemId: string,
  warehouseId: string | null,
): Promise<LowStockLevel | null | "unknown"> {
  const { data: item, error: itemErr } = await supabaseServer
    .from("inventory_items")
    .select("id, item_name, item_code, min_stock, reorder_point, track_stock")
    .eq("id", inventoryItemId)
    .maybeSingle();
  if (itemErr) { console.error("[notify-lite] low-stock item read:", itemErr.message); return "unknown"; }
  if (!item) return null;
  const limit = lowStockThreshold(item);
  if (!limit) return null;

  let bq = supabaseServer
    .from("inventory_stock_balances")
    .select("qty_on_hand")
    .eq("inventory_item_id", inventoryItemId);
  if (tenantId) bq = bq.eq("tenant_id", tenantId);
  if (warehouseId) bq = bq.eq("warehouse_id", warehouseId);
  const { data: balances, error: balErr } = await bq;
  if (balErr) { console.error("[notify-lite] low-stock balance read:", balErr.message); return "unknown"; }
  const qty = ((balances ?? []) as Array<{ qty_on_hand: number | null }>)
    .reduce((s, b) => s + (Number(b.qty_on_hand) || 0), 0);
  const name = ((item.item_name as string | null) || (item.item_code as string | null) || "").trim() || null;
  return { name, qty, threshold: limit.at, by: limit.by, low: isLowStock(qty, item) };
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
    if (!level || level === "unknown" || !level.low) return;
    const { qty, threshold, by } = level;

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
      tpl: level.name
        ? { k: "low_stock_alert", p: { item: level.name, qty, threshold, by } }
        : { k: "low_stock_alert.unnamed", p: { qty, threshold, by } },
      link: "/inventory/items?filter=low_stock",
      type: "low_stock_alert",
      metadata: { source: "inventory", item_id: inventoryItemId, warehouse_id: warehouseId, qty, threshold, threshold_by: by },
      tag: `lowstock:${inventoryItemId}`,
      supersede: lowStockKey(inventoryItemId, warehouseId),
    });
  } catch (e) {
    console.error("[notify-lite] low-stock", e instanceof Error ? e.message : e);
  }
}

/** Stock came IN (a receipt, a transfer arriving, a voided shipment): if the
 *  item is back above its low-stock line there — or no longer has one — its
 *  unread alerts are settled. A failed read settles nothing. */
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
    if (level === "unknown" || (level && level.low)) return;
    await clearUnreadByMeta(key);
  } catch (e) {
    console.error("[notify-lite] low-stock clear", e instanceof Error ? e.message : e);
  }
}
