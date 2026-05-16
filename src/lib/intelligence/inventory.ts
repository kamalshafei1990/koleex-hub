/* ===========================================================================
   Inventory Adapter  —  Phase 2.0

   Inventory remains a separate app and may not be wired yet. This
   module exposes a stable adapter contract so the rest of the
   intelligence layer can read inventory state regardless of whether
   the source exists. When the Inventory app's data flows in later, only
   the loader changes — consumers stay identical.

   The adapter understands two operational signals on top of raw stock:

     · reservedForUnpaid     value of stock allocated to overdue/AR-risk
                             orders (Finance reaches inside Inventory).
     · agingInventoryValue   value of SKUs sitting > 90 days.

   For Phase 2.0 the loader returns `available: false` so consumers
   render an empty inventory tile gracefully. The shape is the contract.
   ========================================================================== */

import type { FinanceOrder } from "@/lib/finance/types";
import type { InventorySnapshot, Pressure } from "./types";
import { daysFromToday } from "./behavior";

/* ---------------------------------------------------------------------------
   Future-ready raw input shape. Real Inventory will provide records of
   this form via its own endpoint (no schema changes here yet).
   --------------------------------------------------------------------------- */

export interface InventoryRecord {
  sku: string;
  description?: string;
  quantity: number;
  unitValue: number;
  safetyStock?: number;
  /** ISO date of last movement. */
  lastMovementAt?: string;
  /** Reserved against an order? */
  reservedOrderId?: string;
}

/* ---------------------------------------------------------------------------
   Pure: compute snapshot from records + orders.
   --------------------------------------------------------------------------- */

export function computeInventorySnapshot(args: {
  records: InventoryRecord[];
  orders: FinanceOrder[];
}): InventorySnapshot {
  const { records, orders } = args;
  if (records.length === 0) {
    return {
      available: false,
      pressure: "calm",
      read: "Inventory module not connected yet — operational impact tracking will activate when Inventory data flows in.",
    };
  }

  const overdueOrAtRiskOrderIds = new Set(
    orders
      .filter((o) => {
        const due = daysFromToday(o.payment_due_date);
        return (o.outstanding_receivable ?? 0) > 0 && (due ?? 0) <= 0;
      })
      .map((o) => o.id)
  );

  let belowSafety = 0;
  let reservedForUnpaid = 0;
  let agingValue = 0;
  for (const r of records) {
    const value = (Number(r.quantity) || 0) * (Number(r.unitValue) || 0);
    if (r.safetyStock != null && r.quantity < r.safetyStock) belowSafety += 1;
    if (r.reservedOrderId && overdueOrAtRiskOrderIds.has(r.reservedOrderId)) {
      reservedForUnpaid += value;
    }
    if (r.lastMovementAt) {
      const days = daysFromToday(r.lastMovementAt);
      if (days != null && days <= -90) agingValue += value;
    }
  }

  let pressure: Pressure = "calm";
  if (belowSafety >= 8 || reservedForUnpaid > 0) pressure = "watch";
  if (belowSafety >= 20 || agingValue > 0 && agingValue >= 50_000) pressure = "risk";
  if (belowSafety >= 40) pressure = "critical";

  return {
    available: true,
    totalSkus: records.length,
    belowSafetyStock: belowSafety,
    reservedForUnpaid: Math.round(reservedForUnpaid),
    agingInventoryValue: Math.round(agingValue),
    pressure,
    read: buildInventoryRead({ belowSafety, reservedForUnpaid, agingValue }),
  };
}

function buildInventoryRead(args: { belowSafety: number; reservedForUnpaid: number; agingValue: number }): string {
  const { belowSafety, reservedForUnpaid, agingValue } = args;
  const bits: string[] = [];
  if (belowSafety > 0) bits.push(`${belowSafety} SKU${belowSafety === 1 ? "" : "s"} below safety stock.`);
  if (reservedForUnpaid > 0) bits.push(`${formatCompact(reservedForUnpaid)} USD of stock reserved for at-risk orders.`);
  if (agingValue > 0) bits.push(`${formatCompact(agingValue)} USD of inventory aging > 90 days.`);
  if (bits.length === 0) bits.push(`Inventory profile healthy.`);
  return bits.join(" ");
}

function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 1_000_000) return sign + (abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2) + "M";
  if (abs >= 1_000)     return sign + (abs / 1_000).toFixed(abs >= 10_000 ? 1 : 2) + "K";
  return sign + abs.toFixed(0);
}
