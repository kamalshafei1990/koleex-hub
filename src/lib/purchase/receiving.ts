import "server-only";

/* ===========================================================================
   Phase O.3 — Purchase Receiving Engine.

   Single entry point: receivePurchaseOrder()

   Flow (one transactional intent — multiple supabase calls, but each
   step idempotent so a retry converges):

     1. Load + tenant-check the PO and its items.
     2. Validate every line:
         - po_item_id belongs to this PO
         - qty_received > 0 (zero lines are skipped, not rejected)
         - qty_accepted + qty_rejected <= qty_received
         - qty_accepted cannot push qty_received above PO line qty
           (over-receipt is rejected — over-receipt allowance is a
            later phase)
     3. Resolve the receipt-level warehouse_id (default if omitted).
     4. INSERT a purchase_receipts row in status='draft', then a
        purchase_receipt_items row per input line.
     5. For each line where qty_accepted > 0:
           create + post an inventory_stock_movement of
             movement_type = 'purchase_receipt'
             direction     = 'in'
             source_type   = 'purchase_receipt'
             source_id     = <receipt_item_id>
           and store the movement id back on the line. Source
           idempotency at the inventory layer protects against
           double-posting a re-confirm.
     6. Flip the receipt to status='posted', stamp posted_at/by.
     7. Call fn_purchase_recompute_po_status to roll qty_received
        forward + decide PO header status.

   The function is callable as a fire-and-forget HTTP handler — it
   returns a structured outcome with the receipt id, the posted
   inventory movement ids, and the resulting PO status.

   Voiding: voidPurchaseReceipt() reverses each inventory movement
   the receipt produced, flips the receipt to 'voided', and re-runs
   the PO recompute so the qty_received column rolls back.
   ========================================================================== */

import { supabaseServer } from "@/lib/server/supabase-server";
import { resolveBaseCurrency } from "@/lib/finance/currency";
import { createInventoryMovement, postInventoryMovement, voidInventoryMovement, ensureDefaultWarehouse } from "@/lib/inventory/posting";
import {
  ensureInventoryItemForProduct,
  ensureSpecialLocation,
  type SpecialLocationType,
} from "@/lib/inventory/items";
import type {
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseReceipt,
  ReceiveDestinationMode,
  ReceiveOutcome,
  ReceiveRequest,
  PurchaseOrderStatus,
} from "./types";

const STOCK_MOVING_MODES = new Set<ReceiveDestinationMode>([
  "warehouse", "port", "forwarder", "in_transit", "consolidation",
  "direct_ship_to_customer", "exhibition", "demo_location",
]);

/* Map destination_mode → location_type for find-or-create. */
function locationTypeForMode(mode: ReceiveDestinationMode): SpecialLocationType | "warehouse" | null {
  switch (mode) {
    case "warehouse":               return "warehouse";
    case "port":                    return "port";
    case "forwarder":               return "forwarder";
    case "in_transit":              return "in_transit";
    case "consolidation":           return "consolidation_point";
    case "direct_ship_to_customer": return "customer_location";
    case "exhibition":              return "exhibition_site";
    case "demo_location":           return "demo_location";
    case "non_stock_purchase":      return null;
  }
}

function generateReceiptNo(): string {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const tail = (Date.now().toString(16) + Math.random().toString(16).slice(2))
    .replace(/\./g, "")
    .slice(-6)
    .toUpperCase();
  return `GR-${ymd}-${tail}`;
}

export async function receivePurchaseOrder(opts: {
  poId: string;
  tenantId: string;
  receivedBy: string | null;
  request: ReceiveRequest;
}): Promise<ReceiveOutcome> {
  const { poId, tenantId, receivedBy, request } = opts;

  /* 1 — Load PO + items, tenant check. */
  const { data: poRow, error: poErr } = await supabaseServer
    .from("purchase_orders")
    .select("*")
    .eq("id", poId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (poErr) return { ok: false, error: poErr.message, code: 500 };
  if (!poRow) return { ok: false, error: "PO not found", code: 404 };
  const po = poRow as PurchaseOrder;

  if (po.status === "cancelled") return { ok: false, error: "PO is cancelled", code: 409 };
  if (po.status === "closed") return { ok: false, error: "PO is closed", code: 409 };

  const { data: itemsData, error: itemsErr } = await supabaseServer
    .from("purchase_order_items")
    .select("*")
    .eq("po_id", poId);
  if (itemsErr) return { ok: false, error: itemsErr.message, code: 500 };
  const itemMap = new Map<string, PurchaseOrderItem>();
  for (const it of (itemsData ?? []) as PurchaseOrderItem[]) itemMap.set(it.id, it);

  /* 2 — Validate lines. */
  const lines = (request.lines ?? []).filter((l) => Number(l.qty_received) > 0);
  if (lines.length === 0) return { ok: false, error: "No lines to receive", code: 400 };

  for (const l of lines) {
    const poItem = itemMap.get(l.po_item_id);
    if (!poItem) return { ok: false, error: `Unknown po_item_id ${l.po_item_id}`, code: 400 };

    const qtyReceived = Number(l.qty_received) || 0;
    const qtyAccepted = l.qty_accepted != null ? Number(l.qty_accepted) : qtyReceived;
    const qtyRejected = l.qty_rejected != null ? Number(l.qty_rejected) : 0;
    if (qtyAccepted < 0 || qtyRejected < 0) {
      return { ok: false, error: "Quantities must be non-negative", code: 400 };
    }
    if (qtyAccepted + qtyRejected > qtyReceived + 0.0001) {
      return { ok: false, error: "qty_accepted + qty_rejected > qty_received", code: 400 };
    }
    /* Over-receipt guard: the cumulative qty_received on this PO line
       (already received + this batch) must not exceed the ordered qty.
       Over-receipt tolerance is a later phase. */
    const cumulative = (Number(poItem.qty_received) || 0) + qtyAccepted;
    if (cumulative > Number(poItem.qty) + 0.0001) {
      return {
        ok: false,
        error: `Over-receipt on PO line: ordered ${poItem.qty}, already received ${poItem.qty_received}, attempting +${qtyAccepted}`,
        code: 422,
      };
    }
  }

  /* 3 — Resolve receipt-level destination.
     The mode dictates which physical or virtual location stock lands
     in. We resolve the destination once at receipt-header level; line
     overrides are still honored on the line itself for the rare case
     where one receipt splits stock across two locations of the same
     mode. */
  const destinationMode: ReceiveDestinationMode = request.destination_mode ?? "warehouse";
  const affectsInventory = STOCK_MOVING_MODES.has(destinationMode);

  if (destinationMode === "direct_ship_to_customer" && !request.customer_id) {
    return { ok: false, error: "customer_id required for direct_ship_to_customer", code: 400 };
  }

  let warehouseId: string | null = null;
  if (affectsInventory) {
    if (request.destination_location_id) {
      warehouseId = request.destination_location_id;
    } else if (destinationMode === "warehouse") {
      warehouseId = request.warehouse_id ?? (await ensureDefaultWarehouse(tenantId));
    } else {
      const locType = locationTypeForMode(destinationMode);
      if (locType && locType !== "warehouse") {
        warehouseId = await ensureSpecialLocation(tenantId, locType, {
          name:
            destinationMode === "port"          ? request.port_name :
            destinationMode === "forwarder"     ? request.forwarder_name :
            destinationMode === "exhibition"    ? request.exhibition_name :
            destinationMode === "demo_location" ? request.demo_location_name :
            null,
          customer_id: destinationMode === "direct_ship_to_customer" ? request.customer_id ?? null : null,
        });
      }
    }
  }

  /* 4 — Insert receipt header + lines. */
  const grNo = generateReceiptNo();
  const receivedAt = request.received_at ?? new Date().toISOString();
  /* Currency stabilization — fall back to tenant base if the PO row
     somehow has a null currency. */
  const receiptCcy = po.currency ?? (await resolveBaseCurrency(tenantId));
  const { data: receiptRow, error: rcptErr } = await supabaseServer
    .from("purchase_receipts")
    .insert({
      tenant_id: tenantId,
      gr_no: grNo,
      po_id: poId,
      supplier_id: po.supplier_id,
      warehouse_id: warehouseId,
      destination_mode: destinationMode,
      destination_location_id: warehouseId,
      customer_id: request.customer_id ?? null,
      shipment_reference: request.shipment_reference ?? null,
      forwarder_name: request.forwarder_name ?? null,
      port_name: request.port_name ?? null,
      container_no: request.container_no ?? null,
      expected_ship_date: request.expected_ship_date ?? null,
      expected_arrival_date: request.expected_arrival_date ?? null,
      status: "draft",
      received_at: receivedAt,
      received_by_account_id: receivedBy,
      carrier: request.carrier ?? null,
      tracking_no: request.tracking_no ?? null,
      notes: request.notes ?? null,
    })
    .select("id, gr_no")
    .single();
  if (rcptErr || !receiptRow) return { ok: false, error: rcptErr?.message ?? "Insert failed", code: 500 };
  const receiptId = (receiptRow as { id: string }).id;
  const receiptNo = (receiptRow as { gr_no: string | null }).gr_no;

  const lineRows = lines.map((l) => {
    const poItem = itemMap.get(l.po_item_id)!;
    const qtyReceived = Number(l.qty_received) || 0;
    const qtyAccepted = l.qty_accepted != null ? Number(l.qty_accepted) : qtyReceived;
    const qtyRejected = l.qty_rejected != null ? Number(l.qty_rejected) : 0;
    return {
      tenant_id: tenantId,
      receipt_id: receiptId,
      po_item_id: poItem.id,
      product_id: poItem.product_id,
      /* Carry the PO line's inventory_item_id forward immediately so
         the receipt line knows what it represents even before stock
         is posted (relevant for non_stock_purchase too — bookkeeping
         needs to know which item the receipt was for). */
      inventory_item_id: poItem.inventory_item_id ?? null,
      description: poItem.description,
      qty_received: qtyReceived,
      qty_accepted: qtyAccepted,
      qty_rejected: qtyRejected,
      unit: poItem.unit ?? "pc",
      unit_cost: poItem.unit_cost,
      currency: receiptCcy,
      /* For non-stock purchases there's no location; for stock-moving
         modes the line override (rare) or receipt-level destination wins. */
      warehouse_id: affectsInventory ? (l.warehouse_id ?? warehouseId) : null,
      condition_notes: l.condition_notes ?? null,
    };
  });

  const { data: insertedLines, error: linesErr } = await supabaseServer
    .from("purchase_receipt_items")
    .insert(lineRows)
    .select("*");
  if (linesErr || !insertedLines) {
    /* Roll the receipt header back so the caller can retry. */
    await supabaseServer.from("purchase_receipts").delete().eq("id", receiptId);
    return { ok: false, error: linesErr?.message ?? "Line insert failed", code: 500 };
  }

  /* 5 — Create + post inventory movements.
     For 'non_stock_purchase' the engine skips this step entirely so
     the receipt records the event for AP/expense without touching
     inventory. For every other destination mode we post movements
     into the resolved location (warehouse, port, forwarder, etc.). */
  const movementIds: string[] = [];
  if (affectsInventory) {
    for (const line of insertedLines as Array<{
      id: string;
      product_id: string | null;
      inventory_item_id: string | null;
      qty_accepted: number;
      warehouse_id: string | null;
      unit_cost: number | null;
      currency: string;
      unit: string | null;
    }>) {
      /* Universal-inventory routing:
           1. PO line carried inventory_item_id  → use it directly
           2. PO line carried only a product_id → derive / auto-create
              an inventory item from the product (back-compat)
           3. Neither → free-text / service line, no stock impact */
      let inventoryItemId: string | null = line.inventory_item_id;
      if (!inventoryItemId && line.product_id) {
        inventoryItemId = await ensureInventoryItemForProduct(tenantId, line.product_id);
      }
      if (!inventoryItemId) continue;          // service / non-trackable line

      const qty = Number(line.qty_accepted) || 0;
      if (qty <= 0) continue;

      const created = await createInventoryMovement({
        tenant_id: tenantId,
        inventory_item_id: inventoryItemId,
        warehouse_id: line.warehouse_id ?? warehouseId,
        movement_type: "purchase_receipt",
        quantity: qty,
        unit: line.unit ?? "pc",
        unit_cost: line.unit_cost,
        currency: line.currency,
        source_type: "purchase_receipt",
        source_id: line.id,                    // line-level idempotency
        reference: receiptNo,
        created_by: receivedBy,
        metadata: { destination_mode: destinationMode },
      });
      if (!created.ok || !created.movement) {
        return { ok: false, error: `Inventory create failed: ${created.error}`, code: 500 };
      }
      const posted = await postInventoryMovement(created.movement.id, tenantId, receivedBy);
      if (!posted.ok) {
        return { ok: false, error: `Inventory post failed: ${posted.error}`, code: 500 };
      }
      movementIds.push(created.movement.id);
      await supabaseServer
        .from("purchase_receipt_items")
        .update({
          inventory_movement_id: created.movement.id,
          inventory_item_id: inventoryItemId,
        })
        .eq("id", line.id);
    }
  }

  /* 6 — Promote receipt to posted. */
  const { error: postErr } = await supabaseServer
    .from("purchase_receipts")
    .update({
      status: "posted",
      posted_at: new Date().toISOString(),
      posted_by: receivedBy,
    })
    .eq("id", receiptId)
    .eq("tenant_id", tenantId);
  if (postErr) return { ok: false, error: postErr.message, code: 500 };

  /* 7 — Roll up PO status. */
  const { data: poStatusRes } = await supabaseServer.rpc("fn_purchase_recompute_po_status", {
    p_po_id: poId,
    p_tenant_id: tenantId,
  });
  const newStatus = (poStatusRes as { status?: string } | null)?.status as PurchaseOrderStatus | undefined;

  return {
    ok: true,
    receipt_id: receiptId,
    receipt_no: receiptNo,
    destination_mode: destinationMode,
    destination_location_id: warehouseId,
    movement_ids: movementIds,
    affects_inventory: affectsInventory,
    po_status: newStatus,
  };
}

/* ─── Void receipt ─────────────────────────────────────────────
   Reverses every inventory movement this receipt posted, flips the
   receipt to 'voided', and re-runs the PO recompute so qty_received
   rolls back. Idempotent: re-voiding a voided receipt is a no-op. */

export async function voidPurchaseReceipt(opts: {
  receiptId: string;
  tenantId: string;
  voidedBy: string | null;
  reason: string | null;
}): Promise<ReceiveOutcome> {
  const { receiptId, tenantId, voidedBy, reason } = opts;

  const { data: rcptRow, error: rcptErr } = await supabaseServer
    .from("purchase_receipts")
    .select("*")
    .eq("id", receiptId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (rcptErr) return { ok: false, error: rcptErr.message, code: 500 };
  if (!rcptRow) return { ok: false, error: "Receipt not found", code: 404 };
  const receipt = rcptRow as PurchaseReceipt;
  if (receipt.status === "voided") return { ok: true, receipt_id: receiptId, receipt_no: receipt.gr_no };
  if (receipt.status !== "posted") return { ok: false, error: "Only posted receipts can be voided", code: 409 };

  const { data: lineRows } = await supabaseServer
    .from("purchase_receipt_items")
    .select("id, inventory_movement_id")
    .eq("receipt_id", receiptId)
    .eq("tenant_id", tenantId);
  for (const l of ((lineRows ?? []) as Array<{ id: string; inventory_movement_id: string | null }>)) {
    if (!l.inventory_movement_id) continue;
    const r = await voidInventoryMovement(l.inventory_movement_id, tenantId, voidedBy, reason ?? `Void of receipt ${receipt.gr_no}`);
    if (!r.ok && !r.already_voided) {
      return { ok: false, error: `Inventory void failed: ${r.error}`, code: 500 };
    }
  }

  const { error: voidErr } = await supabaseServer
    .from("purchase_receipts")
    .update({
      status: "voided",
      voided_at: new Date().toISOString(),
      voided_by: voidedBy,
      void_reason: reason,
    })
    .eq("id", receiptId)
    .eq("tenant_id", tenantId);
  if (voidErr) return { ok: false, error: voidErr.message, code: 500 };

  if (receipt.po_id) {
    await supabaseServer.rpc("fn_purchase_recompute_po_status", {
      p_po_id: receipt.po_id,
      p_tenant_id: tenantId,
    });
  }

  return { ok: true, receipt_id: receiptId, receipt_no: receipt.gr_no };
}
