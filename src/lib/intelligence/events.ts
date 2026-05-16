/* ===========================================================================
   Operational Event Stream  —  Phase 2.0

   Synthesises a list of OperationalEvents from the current state of each
   module. Events are SIGNALS, not notifications: they exist so the
   relationship engine, Copilot, and workflow rail can react to them.

   The synthesis is idempotent — running it twice over the same input
   produces the same event keys, so consumers can dedupe trivially.
   ========================================================================== */

import type { DashboardKpi, FinanceOrder } from "@/lib/finance/types";
import type {
  OperationalEvent,
  OperationalEventKind,
  Severity,
  CustomerBehaviorProfile,
  SupplierDependencyProfile,
  LogisticsSnapshot,
  InventorySnapshot,
} from "./types";
import { daysFromToday, stableId } from "./behavior";

const NOW = () => Date.now();

function ev(args: {
  key: string;
  source: OperationalEvent["source"];
  kind: OperationalEventKind;
  severity: Severity;
  label: string;
  detail: string;
  entity?: OperationalEvent["entity"];
  magnitude?: number;
  amount?: number;
  direction?: OperationalEvent["direction"];
}): OperationalEvent {
  return { ts: NOW(), ...args };
}

/* ---------------------------------------------------------------------------
   Synthesis  —  one shot.
   --------------------------------------------------------------------------- */

export function synthesizeEvents(args: {
  kpi: DashboardKpi | null;
  orders: FinanceOrder[];
  customers: CustomerBehaviorProfile[];
  suppliers: SupplierDependencyProfile[];
  logistics: LogisticsSnapshot;
  inventory?: InventorySnapshot;
}): OperationalEvent[] {
  const out: OperationalEvent[] = [];
  const { kpi, orders, customers, suppliers, logistics, inventory } = args;

  /* ── Finance: liquidity, margin, revenue ─────────────── */
  if (kpi) {
    if (kpi.delta.revenue_pct != null && kpi.delta.revenue_pct <= -20) {
      out.push(ev({
        key: "fin-revenue-decline",
        source: "finance",
        kind: "revenue_decline",
        severity: kpi.delta.revenue_pct <= -40 ? "risk" : "watch",
        direction: "down",
        magnitude: Math.abs(kpi.delta.revenue_pct),
        label: `Revenue ↓ ${Math.abs(kpi.delta.revenue_pct).toFixed(0)}%`,
        detail: "Revenue declined materially versus the prior period.",
      }));
    }
    if ((kpi.gross_margin_pct ?? 0) < 15) {
      const margin = kpi.gross_margin_pct ?? 0;
      out.push(ev({
        key: "fin-margin-drop",
        source: "finance",
        kind: "margin_drop",
        severity: margin < 0 ? "critical" : margin < 8 ? "risk" : "watch",
        direction: "down",
        magnitude: margin,
        label: `Gross margin ${margin.toFixed(1)}%`,
        detail: margin < 0
          ? "Gross margin is negative — revenue is not covering supplier costs."
          : "Gross margin compressed below the 15% threshold.",
      }));
    }
    /* Liquidity pressure — simple heuristic: AP > AR materially. */
    if (kpi.accounts_payable > 0 && kpi.accounts_payable > kpi.accounts_receivable * 1.4) {
      out.push(ev({
        key: "fin-liquidity",
        source: "finance",
        kind: "liquidity_pressure",
        severity: kpi.accounts_payable > kpi.accounts_receivable * 2 ? "risk" : "watch",
        magnitude: kpi.accounts_payable - kpi.accounts_receivable,
        amount: kpi.accounts_payable,
        label: "AP exceeds AR materially",
        detail: "Outgoing obligations exceed scheduled receivables — liquidity window tightening.",
      }));
    }
  }

  /* ── Orders: overdue payments ─────────────────────────── */
  for (const o of orders) {
    const out_amount = o.outstanding_receivable ?? 0;
    if (out_amount <= 0) continue;
    const due = daysFromToday(o.payment_due_date);
    if (due == null || due >= 0) continue;
    const overdueDays = -due;
    const severity: Severity = overdueDays >= 60 ? "critical" : overdueDays >= 30 ? "risk" : "watch";
    out.push(ev({
      key: stableId(["overdue", o.id]),
      source: "customer",
      kind: "overdue_payment",
      severity,
      entity: { type: "order", id: o.id, name: o.customer_name },
      amount: out_amount,
      magnitude: overdueDays,
      direction: "up",
      label: `${o.customer_name || "Customer"} · ${overdueDays}d overdue`,
      detail: `Order ${o.order_no} is ${overdueDays} days past due with ${formatCompact(out_amount)} USD outstanding.`,
    }));
  }

  /* ── Suppliers: due / overdue / dependency ───────────── */
  for (const o of orders) {
    for (const s of o.suppliers ?? []) {
      const outstanding = Math.max(0, (s.supplier_cost ?? 0) - (s.paid_amount ?? 0));
      if (outstanding <= 0) continue;
      const due = daysFromToday(s.due_date);
      if (due == null) continue;
      if (due < 0) {
        out.push(ev({
          key: stableId(["supplier-overdue", s.id]),
          source: "supplier",
          kind: "supplier_overdue",
          severity: -due >= 30 ? "risk" : "watch",
          entity: { type: "supplier", id: s.supplier_id ?? undefined, name: s.supplier_name },
          amount: outstanding,
          magnitude: -due,
          direction: "up",
          label: `${s.supplier_name || "Supplier"} · ${-due}d overdue`,
          detail: `Supplier payment past due by ${-due} days, ${formatCompact(outstanding)} USD outstanding.`,
        }));
      } else if (due <= 7) {
        out.push(ev({
          key: stableId(["supplier-due", s.id]),
          source: "supplier",
          kind: "supplier_due",
          severity: due <= 3 ? "watch" : "info",
          entity: { type: "supplier", id: s.supplier_id ?? undefined, name: s.supplier_name },
          amount: outstanding,
          magnitude: due,
          label: `${s.supplier_name || "Supplier"} due in ${due}d`,
          detail: `Supplier payment of ${formatCompact(outstanding)} USD due within ${due} days.`,
        }));
      }
    }
  }
  /* Single-supplier dependency. */
  for (const s of suppliers) {
    if (s.cogsShare >= 50) {
      out.push(ev({
        key: stableId(["supplier-dependency", s.id]),
        source: "supplier",
        kind: "supplier_dependency",
        severity: s.cogsShare >= 70 ? "risk" : "watch",
        entity: { type: "supplier", id: s.id, name: s.name },
        magnitude: s.cogsShare,
        label: `${s.name} · ${s.cogsShare.toFixed(0)}% of COGS`,
        detail: `Procurement is heavily concentrated on ${s.name}.`,
      }));
    }
  }

  /* ── Customers: concentration + collection delay ─────── */
  for (const c of customers) {
    if (c.revenueShare >= 40) {
      out.push(ev({
        key: stableId(["customer-concentration", c.id]),
        source: "customer",
        kind: "customer_concentration",
        severity: c.revenueShare >= 60 ? "risk" : "watch",
        entity: { type: "customer", id: c.id, name: c.name },
        magnitude: c.revenueShare,
        label: `${c.name} · ${c.revenueShare.toFixed(0)}% of revenue`,
        detail: `${c.name} dominates the period's revenue mix.`,
      }));
    }
    if (c.collection.trend === "up" && c.collection.delayTrendDays >= 5) {
      out.push(ev({
        key: stableId(["customer-collection-delay", c.id]),
        source: "customer",
        kind: "collection_delay",
        severity: c.collection.delayTrendDays >= 14 ? "risk" : "watch",
        entity: { type: "customer", id: c.id, name: c.name },
        magnitude: c.collection.delayTrendDays,
        direction: "up",
        label: `${c.name} · slower by ${c.collection.delayTrendDays.toFixed(0)}d`,
        detail: `Average collection delay for ${c.name} grew by ${c.collection.delayTrendDays.toFixed(0)} days versus the prior 90 days.`,
      }));
    }
  }

  /* ── Logistics: spike ─────────────────────────────────── */
  if (logistics.trend === "up" && logistics.trendPct >= 12) {
    out.push(ev({
      key: "logistics-spike",
      source: "logistics",
      kind: "logistics_spike",
      severity: logistics.trendPct >= 25 ? "risk" : "watch",
      direction: "up",
      magnitude: logistics.trendPct,
      amount: logistics.total,
      label: `Logistics ↑ ${logistics.trendPct.toFixed(0)}%`,
      detail: logistics.read,
    }));
  }

  /* ── Inventory: future hook ──────────────────────────── */
  if (inventory && inventory.available) {
    if ((inventory.belowSafetyStock ?? 0) > 0) {
      out.push(ev({
        key: "inv-shortage",
        source: "inventory",
        kind: "inventory_shortage",
        severity: (inventory.belowSafetyStock ?? 0) >= 20 ? "risk" : "watch",
        magnitude: inventory.belowSafetyStock,
        label: `${inventory.belowSafetyStock} SKUs below safety stock`,
        detail: inventory.read,
      }));
    }
    if ((inventory.agingInventoryValue ?? 0) > 0) {
      out.push(ev({
        key: "inv-excess",
        source: "inventory",
        kind: "inventory_excess",
        severity: "watch",
        amount: inventory.agingInventoryValue,
        label: "Aging inventory > 90 days",
        detail: inventory.read,
      }));
    }
  }

  /* Sort by severity then magnitude. */
  const sevRank: Record<Severity, number> = { critical: 0, risk: 1, watch: 2, info: 3 };
  return out.sort((a, b) =>
    sevRank[a.severity] - sevRank[b.severity] ||
    (b.magnitude ?? 0) - (a.magnitude ?? 0)
  );
}

function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 1_000_000) return sign + (abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2) + "M";
  if (abs >= 1_000)     return sign + (abs / 1_000).toFixed(abs >= 10_000 ? 1 : 2) + "K";
  return sign + abs.toFixed(0);
}
