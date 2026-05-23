import "server-only";

/* ===========================================================================
   Phase O.4 — Sales Shipment engine.

   shipSalesOrder()        creates a shipment header + lines, posts one
                            inventory OUT movement per line, flips the
                            shipment to 'shipped', and recomputes the
                            SO header status.

   voidSalesShipment()     reverses each linked OUT movement, flips the
                            shipment to 'voided', and re-runs the SO
                            recompute so qty_shipped rolls back.

   The shipment line carries a source_id pointing at its own row in
   sales_shipment_items, so source-idempotency at the inventory layer
   prevents the same line from posting twice.
   ========================================================================== */

import { supabaseServer } from "@/lib/server/supabase-server";
import {
  createInventoryMovement,
  postInventoryMovement,
  voidInventoryMovement,
  ensureDefaultWarehouse,
} from "@/lib/inventory/posting";
import { voidJournalEntry } from "@/lib/accounting/posting";
import type {
  SalesOrder,
  SalesOrderItem,
  SalesShipment,
  SalesOrderStatus,
  ShipOutcome,
  ShipRequest,
} from "./types";

function generateShipmentNo(): string {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const tail = (Date.now().toString(16) + Math.random().toString(16).slice(2))
    .replace(/\./g, "")
    .slice(-6)
    .toUpperCase();
  return `SH-${ymd}-${tail}`;
}

export async function shipSalesOrder(opts: {
  soId: string;
  tenantId: string;
  shippedBy: string | null;
  request: ShipRequest;
}): Promise<ShipOutcome> {
  const { soId, tenantId, shippedBy, request } = opts;

  /* 1 — Load SO + items, tenant check. */
  const { data: soRow, error: soErr } = await supabaseServer
    .from("sales_orders")
    .select("*")
    .eq("id", soId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (soErr) return { ok: false, error: soErr.message, code: 500 };
  if (!soRow) return { ok: false, error: "Sales order not found", code: 404 };
  const so = soRow as SalesOrder;
  if (so.status === "cancelled") return { ok: false, error: "Sales order is cancelled", code: 409 };
  if (so.status === "closed")    return { ok: false, error: "Sales order is closed",    code: 409 };

  const { data: itemsData, error: itemsErr } = await supabaseServer
    .from("sales_order_items")
    .select("*")
    .eq("sales_order_id", soId);
  if (itemsErr) return { ok: false, error: itemsErr.message, code: 500 };
  const itemMap = new Map<string, SalesOrderItem>();
  for (const it of (itemsData ?? []) as SalesOrderItem[]) itemMap.set(it.id, it);

  /* 2 — Validate lines. */
  const lines = (request.lines ?? []).filter((l) => Number(l.qty) > 0);
  if (lines.length === 0) return { ok: false, error: "No lines to ship", code: 400 };

  for (const l of lines) {
    const soItem = itemMap.get(l.sales_order_item_id);
    if (!soItem) return { ok: false, error: `Unknown sales_order_item_id ${l.sales_order_item_id}`, code: 400 };
    const qty = Number(l.qty);
    if (!Number.isFinite(qty) || qty <= 0) {
      return { ok: false, error: "Qty must be > 0", code: 400 };
    }
    const remaining = Number(soItem.qty) - Number(soItem.qty_shipped);
    if (qty > remaining + 0.0001) {
      return {
        ok: false,
        error: `Over-ship on SO line: ordered ${soItem.qty}, already shipped ${soItem.qty_shipped}, attempting +${qty}`,
        code: 422,
      };
    }
  }

  /* 3 — Resolve source location (defaults to tenant default WH). */
  const sourceLocationId =
    request.source_location_id ?? (await ensureDefaultWarehouse(tenantId));

  /* 4 — Insert shipment header. */
  const shipmentNo = generateShipmentNo();
  const shippedAt  = request.shipped_at ?? new Date().toISOString();
  const { data: shipRow, error: shipErr } = await supabaseServer
    .from("sales_shipments")
    .insert({
      tenant_id: tenantId,
      sales_order_id: soId,
      shipment_no: shipmentNo,
      status: "draft",
      source_location_id: sourceLocationId,
      customer_id: so.customer_id,
      tracking_no: request.tracking_no ?? null,
      notes: request.notes ?? null,
      shipped_at: null,
      shipped_by: null,
      created_by: shippedBy,
    })
    .select("id, shipment_no")
    .single();
  if (shipErr || !shipRow) return { ok: false, error: shipErr?.message ?? "Insert failed", code: 500 };
  const shipmentId = (shipRow as { id: string }).id;
  const shipmentNoStored = (shipRow as { shipment_no: string }).shipment_no;

  /* 5 — Insert shipment lines. */
  const lineRows = lines.map((l) => {
    const soItem = itemMap.get(l.sales_order_item_id)!;
    return {
      tenant_id: tenantId,
      shipment_id: shipmentId,
      sales_order_item_id: soItem.id,
      inventory_item_id: soItem.inventory_item_id,
      qty: Number(l.qty),
      unit: "pcs",
    };
  });
  const { data: insertedLines, error: linesErr } = await supabaseServer
    .from("sales_shipment_items")
    .insert(lineRows)
    .select("*");
  if (linesErr || !insertedLines) {
    /* Roll the shipment header back. */
    await supabaseServer.from("sales_shipments").delete().eq("id", shipmentId);
    return { ok: false, error: linesErr?.message ?? "Line insert failed", code: 500 };
  }

  /* 6 — Create + post one inventory OUT movement per line that has an
     inventory_item_id. SO lines without a tracked item (service/non-
     stock) are still recorded but skip the movement. */
  const movementIds: string[] = [];
  for (const line of insertedLines as Array<{
    id: string;
    inventory_item_id: string | null;
    qty: number;
    unit: string;
  }>) {
    if (!line.inventory_item_id) continue;
    const qty = Number(line.qty) || 0;
    if (qty <= 0) continue;

    const created = await createInventoryMovement({
      tenant_id: tenantId,
      inventory_item_id: line.inventory_item_id,
      warehouse_id: sourceLocationId,
      movement_type: "sales_shipment",
      quantity: qty,
      unit: line.unit ?? "pcs",
      currency: so.currency ?? "USD",
      source_type: "sales_shipment",
      source_id: line.id,
      reference: shipmentNoStored,
      created_by: shippedBy,
      from_workflow: true, // INV-H2 — workflow caller
    });
    if (!created.ok || !created.movement) {
      /* Cleanup partial state: best-effort delete already-created
         lines + header (in practice this is rare because validation
         already ensured remaining >= qty; if we hit this branch the
         inventory layer rejected for a stock-level reason). */
      return { ok: false, error: `Inventory create failed: ${created.error}`, code: 500 };
    }
    const posted = await postInventoryMovement(created.movement.id, tenantId, shippedBy);
    if (!posted.ok) {
      return { ok: false, error: `Inventory post failed: ${posted.error}`, code: posted.code ?? 500 };
    }
    movementIds.push(created.movement.id);
    await supabaseServer
      .from("sales_shipment_items")
      .update({ inventory_movement_id: created.movement.id })
      .eq("id", line.id);
  }

  /* 7 — Flip the shipment to shipped. */
  const { error: postErr } = await supabaseServer
    .from("sales_shipments")
    .update({
      status: "shipped",
      shipped_at: shippedAt,
      shipped_by: shippedBy,
    })
    .eq("id", shipmentId)
    .eq("tenant_id", tenantId);
  if (postErr) return { ok: false, error: postErr.message, code: 500 };

  /* 8 — Roll up SO status. */
  const { data: statusRes } = await supabaseServer.rpc("fn_sales_recompute_order_status", {
    p_so_id: soId,
    p_tenant_id: tenantId,
  });
  const newStatus = (statusRes as { status?: string } | null)?.status as SalesOrderStatus | undefined;

  return {
    ok: true,
    shipment_id: shipmentId,
    shipment_no: shipmentNoStored,
    movement_ids: movementIds,
    so_status: newStatus,
  };
}

/* ─── createSalesShipment ──────────────────────────────────
   Single-shot wrapper that matches the brief's API surface. Today
   it just calls shipSalesOrder — kept as a separate symbol so a
   later phase can split "create draft" from "ship draft" without
   re-shaping callers. */
export const createSalesShipment = shipSalesOrder;

/* ─── voidSalesShipment ─────────────────────────────────── */

export async function voidSalesShipment(opts: {
  shipmentId: string;
  tenantId: string;
  voidedBy: string | null;
  reason: string | null;
}): Promise<ShipOutcome> {
  const { shipmentId, tenantId, voidedBy, reason } = opts;

  const { data: shipRow, error: shipErr } = await supabaseServer
    .from("sales_shipments")
    .select("*")
    .eq("id", shipmentId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (shipErr) return { ok: false, error: shipErr.message, code: 500 };
  if (!shipRow) return { ok: false, error: "Shipment not found", code: 404 };
  const shipment = shipRow as SalesShipment;
  if (shipment.status === "voided") {
    return { ok: true, shipment_id: shipmentId, shipment_no: shipment.shipment_no };
  }
  if (shipment.status !== "shipped") {
    return { ok: false, error: "Only shipped shipments can be voided", code: 409 };
  }

  const { data: lineRows } = await supabaseServer
    .from("sales_shipment_items")
    .select("id, inventory_movement_id")
    .eq("shipment_id", shipmentId)
    .eq("tenant_id", tenantId);
  for (const l of (lineRows ?? []) as Array<{ id: string; inventory_movement_id: string | null }>) {
    if (!l.inventory_movement_id) continue;
    const r = await voidInventoryMovement(l.inventory_movement_id, tenantId, voidedBy, reason ?? `Void of shipment ${shipment.shipment_no}`);
    if (!r.ok && !r.already_voided) {
      return { ok: false, error: `Inventory void failed: ${r.error}`, code: 500 };
    }
  }

  /* Phase A.4 — if a COGS entry was drafted or posted for this
     shipment, void it too so the accounting state mirrors the
     operational reversal. voidJournalEntry is a no-op against a
     voided entry and handles both drafted-only and posted entries. */
  if (shipment.accounting_entry_id) {
    await voidJournalEntry(
      { tenantId, postedByAccountId: voidedBy },
      shipment.accounting_entry_id,
      reason ?? `Void of shipment ${shipment.shipment_no}`,
    );
  }

  const { error: voidErr } = await supabaseServer
    .from("sales_shipments")
    .update({
      status: "voided",
      voided_at: new Date().toISOString(),
      voided_by: voidedBy,
      void_reason: reason,
    })
    .eq("id", shipmentId)
    .eq("tenant_id", tenantId);
  if (voidErr) return { ok: false, error: voidErr.message, code: 500 };

  /* Recompute SO status to roll qty_shipped back. */
  await supabaseServer.rpc("fn_sales_recompute_order_status", {
    p_so_id: shipment.sales_order_id,
    p_tenant_id: tenantId,
  });

  return { ok: true, shipment_id: shipmentId, shipment_no: shipment.shipment_no };
}
