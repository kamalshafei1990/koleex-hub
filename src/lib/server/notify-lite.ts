import "server-only";

/* ---------------------------------------------------------------------------
   notify-lite — tiny inbox + push notifier for modules that had no
   notification path at all (inventory transfers, low stock, quotations,
   invoices). Exists because the owner audited Settings → "By activity" and
   demanded every listed activity be REAL: each key must have at least one
   live emitter, or it is a lie in the UI.

   Fire-and-forget by contract: a notification failure must never fail the
   business mutation that triggered it. The `type` string is what the shared
   classifier (lib/notification-activity.ts) buckets on — pick it so it
   lands in the intended activity (e.g. "transfer_*" → inventory_activity,
   "low_stock_alert" → low_stock, "quotation_updated" → quotation_activity).
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { sendPushToAccounts } from "@/lib/server/web-push";

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
}): Promise<void> {
  try {
    const to = Array.from(new Set(opts.recipients.filter(Boolean) as string[]))
      .filter((id) => id !== opts.senderId);
    if (to.length === 0) return;

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

/** Tenant super-admin account ids — the default audience for operational
 *  alerts (low stock) until a finer inventory-role audience exists. */
export async function tenantAdminAccountIds(tenantId: string | null): Promise<string[]> {
  let q = supabaseServer
    .from("accounts")
    .select("id")
    .eq("user_type", "internal")
    .eq("status", "active")
    .eq("is_super_admin", true);
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data } = await q;
  return ((data ?? []) as Array<{ id: string }>).map((a) => a.id);
}

/* Low-stock: after stock LEAVES a warehouse, compare the new balance with
   the item's min_stock/reorder_point and alert the admins — once per
   item+warehouse per 24h so a busy shipping day doesn't spam. */
export async function checkLowStockAndNotify(
  tenantId: string | null,
  inventoryItemId: string,
  warehouseId: string | null,
  actorId: string | null,
): Promise<void> {
  try {
    const { data: item } = await supabaseServer
      .from("inventory_items")
      .select("id, name, min_stock, reorder_point, track_stock")
      .eq("id", inventoryItemId)
      .maybeSingle();
    if (!item) return;
    const threshold = Number(item.min_stock ?? item.reorder_point ?? 0);
    if (!threshold || threshold <= 0 || item.track_stock === false) return;

    let bq = supabaseServer
      .from("inventory_stock_balances")
      .select("qty_on_hand")
      .eq("inventory_item_id", inventoryItemId);
    if (tenantId) bq = bq.eq("tenant_id", tenantId);
    if (warehouseId) bq = bq.eq("warehouse_id", warehouseId);
    const { data: balances } = await bq;
    const qty = ((balances ?? []) as Array<{ qty_on_hand: number | null }>)
      .reduce((s, b) => s + (Number(b.qty_on_hand) || 0), 0);
    if (qty > threshold) return;

    /* 24h dedupe per item(+warehouse). */
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { count } = await supabaseServer
      .from("inbox_messages")
      .select("id", { count: "exact", head: true })
      .eq("metadata->>type", "low_stock_alert")
      .eq("metadata->>item_id", inventoryItemId)
      .gte("created_at", since);
    if ((count ?? 0) > 0) return;

    const admins = await tenantAdminAccountIds(tenantId);
    await notifyLite({
      tenantId,
      recipients: admins,
      senderId: actorId,
      subject: `Low stock: ${item.name ?? "item"}`,
      body: `On hand ${qty} ≤ minimum ${threshold}.`,
      link: "/inventory/items?filter=low_stock",
      type: "low_stock_alert",
      metadata: { source: "inventory", item_id: inventoryItemId, warehouse_id: warehouseId, qty, threshold },
      tag: `lowstock:${inventoryItemId}`,
    });
  } catch (e) {
    console.error("[notify-lite] low-stock", e instanceof Error ? e.message : e);
  }
}
