"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import FinanceTabs from "@/components/finance/FinanceTabs";
import {
  EmptyState,
  KpiCard,
  PageHeader,
  ProgressBar,
  SectionCard,
  StatusBadge,
} from "@/components/finance/FinanceUi";
import { computeOrderProfit, deriveTaxRefundValue, fmtMoney, fmtPct } from "@/lib/finance/calc";
import type { FinanceOrder, FinanceOrderSupplier } from "@/lib/finance/types";

const EMPTY_SUPPLIER: Omit<FinanceOrderSupplier, "id" | "order_id"> = {
  supplier_id: null,
  supplier_name: "",
  supplier_cost: 0,
  currency: "USD",
  payment_status: "unpaid",
  paid_amount: 0,
  due_date: null,
  notes: null,
};

export default function FinanceOrders() {
  const [orders, setOrders] = useState<FinanceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "editor">("list");
  const [draft, setDraft] = useState<DraftOrder | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/finance/orders", { cache: "no-store" });
      const j = (await r.json()) as { orders?: FinanceOrder[] };
      setOrders(j.orders ?? []);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  /* ── KPI summary across all orders ───────────────────────────── */
  const kpi = useMemo(() => {
    const totalSelling = orders.reduce((s, o) => s + (o.selling_price ?? 0), 0);
    const totalNet = orders.reduce((s, o) => s + (o.net_profit ?? 0), 0);
    const totalCollected = orders.reduce((s, o) => s + (o.total_paid ?? 0), 0);
    const totalOutstanding = orders.reduce((s, o) => s + (o.total_outstanding ?? 0), 0);
    const avgMargin = totalSelling > 0 ? (totalNet / totalSelling) * 100 : 0;
    return { totalSelling, totalNet, totalCollected, totalOutstanding, avgMargin };
  }, [orders]);

  const startNew = () => {
    setDraft({
      order: {
        id: undefined,
        order_no: "",
        customer_name: "",
        order_date: new Date().toISOString().slice(0, 10),
        currency: "USD",
        selling_price: 0,
        tax_refund_pct: 0,
        tax_refund_value: 0,
        status: "open",
        payment_status: "unpaid",
        payment_due_date: "",
        notes: "",
      },
      suppliers: [{ ...EMPTY_SUPPLIER }],
    });
    setView("editor");
  };

  const editExisting = (o: FinanceOrder) => {
    setDraft({
      order: {
        id: o.id,
        order_no: o.order_no,
        customer_name: o.customer_name,
        order_date: o.order_date,
        currency: o.currency,
        selling_price: o.selling_price,
        tax_refund_pct: o.tax_refund_pct,
        tax_refund_value: o.tax_refund_value,
        status: o.status,
        payment_status: o.payment_status,
        payment_due_date: o.payment_due_date ?? "",
        notes: o.notes ?? "",
      },
      suppliers: (o.suppliers ?? []).map((s) => ({
        supplier_id: s.supplier_id,
        supplier_name: s.supplier_name,
        supplier_cost: s.supplier_cost,
        currency: s.currency,
        payment_status: s.payment_status,
        paid_amount: s.paid_amount,
        due_date: s.due_date,
        notes: s.notes,
      })),
    });
    setView("editor");
  };

  const save = async () => {
    if (!draft) return;
    const body = { order: draft.order, suppliers: draft.suppliers };
    const r = await fetch("/api/finance/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      alert("Save failed — please try again.");
      return;
    }
    setDraft(null);
    setView("list");
    void load();
  };

  const deleteOrder = async (id: string) => {
    if (!confirm("Delete this order? This cannot be undone.")) return;
    const r = await fetch(`/api/finance/orders/${id}`, { method: "DELETE" });
    if (r.ok) void load();
  };

  if (view === "editor" && draft) {
    return <OrderEditor draft={draft} setDraft={setDraft} onCancel={() => { setView("list"); setDraft(null); }} onSave={save} />;
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
        <PageHeader
          title="Order Profitability"
          subtitle="Track selling price, supplier costs, and realised profit on every order."
          action={
            <button
              type="button"
              onClick={startNew}
              className="rounded-xl bg-[var(--bg-inverted)] px-4 py-2 text-sm font-medium text-[var(--text-inverted)] transition hover:opacity-90 active:scale-95"
            >
              + New Order
            </button>
          }
        />
        <div className="mt-5"><FinanceTabs /></div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard label="Total Orders" value={String(orders.length)} accent="default" loading={loading} />
          <KpiCard label="Total Revenue" value={kpi.totalSelling} currency="USD" accent="emerald" loading={loading} />
          <KpiCard label="Net Profit" value={kpi.totalNet} currency="USD" accent="violet" loading={loading} hint={`Avg margin ${fmtPct(kpi.avgMargin)}`} />
          <KpiCard label="Collected" value={kpi.totalCollected} currency="USD" accent="emerald" loading={loading} />
          <KpiCard label="Outstanding" value={kpi.totalOutstanding} currency="USD" accent="amber" loading={loading} />
        </div>

        <div className="mt-6">
          {loading ? (
            <SectionCard><div className="py-8 text-center text-sm text-gray-500">Loading orders…</div></SectionCard>
          ) : orders.length === 0 ? (
            <EmptyState
              title="No orders yet"
              hint="Create your first order to track revenue, supplier costs, and net profit."
              action={
                <button
                  type="button"
                  onClick={startNew}
                  className="rounded-xl bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-400 transition hover:bg-emerald-500/30"
                >
                  + Create First Order
                </button>
              }
            />
          ) : (
            <div className="grid gap-3">
              {orders.map((o) => <OrderRowCard key={o.id} order={o} onEdit={() => editExisting(o)} onDelete={() => deleteOrder(o.id)} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   ORDER ROW CARD
   Visual summary of one order. Shows the profit waterfall + a
   collected-vs-outstanding progress bar so the operator gets a
   read at a glance.
   ──────────────────────────────────────────────────────────────── */
function OrderRowCard({ order, onEdit, onDelete }: { order: FinanceOrder; onEdit: () => void; onDelete: () => void }) {
  const sellingPrice = order.selling_price ?? 0;
  const supplierCost = order.total_supplier_cost ?? 0;
  const expenses = order.total_order_expenses ?? 0;
  const netProfit = order.net_profit ?? 0;
  const netPct = order.net_profit_pct ?? 0;
  const collected = order.total_paid ?? 0;
  const outstanding = order.total_outstanding ?? 0;
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[var(--bg-secondary)] p-5 transition hover:border-white/[0.10]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm font-semibold text-emerald-400">{order.order_no}</span>
            <StatusBadge status={order.status} />
            <StatusBadge status={order.payment_status} />
          </div>
          <p className="mt-1 text-base font-medium">{order.customer_name || "—"}</p>
          <p className="mt-0.5 text-xs text-gray-500">{order.order_date}{order.payment_due_date ? `  ·  Due ${order.payment_due_date}` : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onEdit} className="rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-3 py-1.5 text-xs font-medium text-gray-300 transition hover:border-white/[0.12]">Edit</button>
          <button type="button" onClick={onDelete} className="rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-3 py-1.5 text-xs font-medium text-rose-400 transition hover:border-rose-500/40">Delete</button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Selling price" value={fmtMoney(sellingPrice, order.currency || "USD", { compact: true })} />
        <Stat label="Supplier cost" value={fmtMoney(supplierCost, order.currency || "USD", { compact: true })} negative />
        <Stat label="Order expenses" value={fmtMoney(expenses, order.currency || "USD", { compact: true })} negative />
        <Stat label="Net profit"     value={fmtMoney(netProfit, order.currency || "USD", { compact: true })} accent={netProfit >= 0 ? "emerald" : "rose"} />
        <Stat label="Margin"         value={fmtPct(netPct)} accent={netPct >= 15 ? "emerald" : netPct >= 0 ? "amber" : "rose"} />
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] text-gray-400">
          <span>Collected: <span className="font-semibold text-emerald-400 tabular-nums">{fmtMoney(collected, order.currency || "USD", { compact: true })}</span></span>
          <span>Outstanding: <span className="font-semibold text-amber-400 tabular-nums">{fmtMoney(outstanding, order.currency || "USD", { compact: true })}</span></span>
        </div>
        <div className="mt-1.5">
          <ProgressBar value={collected} max={sellingPrice} color={collected >= sellingPrice ? "emerald" : "amber"} />
        </div>
      </div>

      {order.suppliers && order.suppliers.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {order.suppliers.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-[var(--bg-primary)] px-3 py-2 text-xs">
              <div className="min-w-0">
                <div className="truncate font-medium text-gray-200">{s.supplier_name || "Unnamed supplier"}</div>
                <div className="text-[10px] text-gray-500">Paid {fmtMoney(s.paid_amount, s.currency, { compact: true })} of {fmtMoney(s.supplier_cost, s.currency, { compact: true })}</div>
              </div>
              <StatusBadge status={s.payment_status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, negative, accent }: { label: string; value: string; negative?: boolean; accent?: "emerald" | "rose" | "amber" }) {
  const color =
    accent === "emerald" ? "text-emerald-400"
    : accent === "rose"  ? "text-rose-400"
    : accent === "amber" ? "text-amber-400"
    : negative ? "text-gray-300" : "text-[var(--text-primary)]";
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className={`mt-1 text-sm font-semibold tabular-nums ${color}`}>{negative && !value.startsWith("0") ? "−" + value : value}</div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   ORDER EDITOR
   Visual step-based form. Sections: Order header, Suppliers, Profit
   preview. The profit preview recomputes live as the operator types.
   ──────────────────────────────────────────────────────────────── */
interface DraftOrder {
  order: {
    id?: string;
    order_no: string;
    customer_name: string;
    order_date: string;
    currency: string;
    selling_price: number;
    tax_refund_pct: number;
    tax_refund_value: number;
    status: FinanceOrder["status"];
    payment_status: FinanceOrder["payment_status"];
    payment_due_date: string;
    notes: string;
  };
  suppliers: Omit<FinanceOrderSupplier, "id" | "order_id">[];
}

function OrderEditor({
  draft,
  setDraft,
  onCancel,
  onSave,
}: {
  draft: DraftOrder;
  setDraft: (d: DraftOrder | null) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const sellingPrice = Number(draft.order.selling_price) || 0;
  const taxValue = deriveTaxRefundValue(
    sellingPrice,
    Number(draft.order.tax_refund_pct) || 0,
    Number(draft.order.tax_refund_value) || 0,
  );
  const profit = computeOrderProfit({
    selling_price: sellingPrice,
    tax_refund_value: taxValue,
    suppliers: draft.suppliers,
    linked_expenses: [],
    customer_payments_total: 0,
  });

  const updateOrder = <K extends keyof DraftOrder["order"]>(k: K, v: DraftOrder["order"][K]) => {
    setDraft({ ...draft, order: { ...draft.order, [k]: v } });
  };
  const addSupplier = () => setDraft({ ...draft, suppliers: [...draft.suppliers, { ...EMPTY_SUPPLIER, currency: draft.order.currency }] });
  const removeSupplier = (i: number) => setDraft({ ...draft, suppliers: draft.suppliers.filter((_, idx) => idx !== i) });
  const updateSupplier = (i: number, patch: Partial<DraftOrder["suppliers"][number]>) => {
    setDraft({ ...draft, suppliers: draft.suppliers.map((s, idx) => idx === i ? { ...s, ...patch } : s) });
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
        <PageHeader
          title={draft.order.id ? `Edit Order ${draft.order.order_no}` : "New Order"}
          subtitle="Capture the selling price, every supplier cost, and let Koleex compute the profit automatically."
          action={
            <div className="flex gap-2">
              <button type="button" onClick={onCancel} className="rounded-xl border border-white/[0.06] bg-[var(--bg-secondary)] px-4 py-2 text-sm font-medium text-gray-300 hover:border-white/[0.12]">Cancel</button>
              <button type="button" onClick={onSave} className="rounded-xl bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-500/30">Save Order</button>
            </div>
          }
        />
        <div className="mt-5"><FinanceTabs /></div>

        {/* Order header */}
        <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <SectionCard title="1 · Order details" subtitle="Customer, date, currency.">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Order No.">
                <input value={draft.order.order_no} onChange={(e) => updateOrder("order_no", e.target.value)} placeholder="Auto on save" className={INPUT} />
              </Field>
              <Field label="Order date">
                <input type="date" value={draft.order.order_date} onChange={(e) => updateOrder("order_date", e.target.value)} className={INPUT} />
              </Field>
              <Field label="Customer" wide>
                <input value={draft.order.customer_name} onChange={(e) => updateOrder("customer_name", e.target.value)} placeholder="Company name" className={INPUT} />
              </Field>
              <Field label="Currency">
                <select value={draft.order.currency} onChange={(e) => updateOrder("currency", e.target.value)} className={INPUT}>
                  {["USD", "EUR", "CNY", "EGP", "GBP"].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select value={draft.order.status} onChange={(e) => updateOrder("status", e.target.value as DraftOrder["order"]["status"])} className={INPUT}>
                  {(["open","in_production","shipped","delivered","closed","cancelled"] as const).map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                </select>
              </Field>
            </div>
          </SectionCard>

          <SectionCard title="2 · Money in" subtitle="Selling price, tax refund, due date.">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Selling price" wide>
                <input type="number" inputMode="decimal" value={draft.order.selling_price} onChange={(e) => updateOrder("selling_price", Number(e.target.value) || 0)} className={INPUT} />
              </Field>
              <Field label="Tax refund %">
                <input type="number" inputMode="decimal" value={draft.order.tax_refund_pct} onChange={(e) => updateOrder("tax_refund_pct", Number(e.target.value) || 0)} className={INPUT} />
              </Field>
              <Field label="Tax refund value">
                <input type="number" inputMode="decimal" value={draft.order.tax_refund_value} onChange={(e) => updateOrder("tax_refund_value", Number(e.target.value) || 0)} placeholder={`${taxValue.toFixed(2)} (derived)`} className={INPUT} />
              </Field>
              <Field label="Payment status">
                <select value={draft.order.payment_status} onChange={(e) => updateOrder("payment_status", e.target.value as DraftOrder["order"]["payment_status"])} className={INPUT}>
                  {(["unpaid","partial","paid","overdue"] as const).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Payment due">
                <input type="date" value={draft.order.payment_due_date} onChange={(e) => updateOrder("payment_due_date", e.target.value)} className={INPUT} />
              </Field>
            </div>
          </SectionCard>

          <SectionCard title="Profit preview" subtitle="Updates live as you type.">
            <PreviewRow label="Selling price"   value={sellingPrice} currency={draft.order.currency} accent="emerald" />
            <PreviewRow label="Tax refund"      value={taxValue} currency={draft.order.currency} accent="emerald" />
            <div className="my-2 border-t border-white/5" />
            <PreviewRow label="Supplier cost"   value={profit.total_supplier_cost} currency={draft.order.currency} accent="rose" negative />
            <PreviewRow label="Gross profit"    value={profit.gross_profit} currency={draft.order.currency} accent="sky" />
            <PreviewRow label="Net profit"      value={profit.net_profit} currency={draft.order.currency} accent="violet" />
            <PreviewRow label="Margin"          value={profit.net_profit_pct} currency="%" accent={profit.net_profit_pct >= 15 ? "emerald" : profit.net_profit_pct >= 0 ? "amber" : "rose"} percent />
          </SectionCard>
        </div>

        {/* Suppliers */}
        <div className="mt-4">
          <SectionCard
            title="3 · Suppliers"
            subtitle="Add every supplier that contributed to this order. The total supplier cost is the sum of these lines."
            action={
              <button type="button" onClick={addSupplier} className="rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-3 py-1.5 text-xs font-medium text-gray-200 hover:border-white/[0.12]">+ Add Supplier</button>
            }
          >
            {draft.suppliers.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-500">No suppliers yet. Click + Add Supplier to record a cost.</div>
            ) : (
              <div className="space-y-3">
                {draft.suppliers.map((s, i) => (
                  <div key={i} className="rounded-xl border border-white/[0.04] bg-[var(--bg-primary)] p-3">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
                      <Field label="Supplier" wide>
                        <input value={s.supplier_name} onChange={(e) => updateSupplier(i, { supplier_name: e.target.value })} placeholder="Supplier name" className={INPUT} />
                      </Field>
                      <Field label="Cost">
                        <input type="number" inputMode="decimal" value={s.supplier_cost} onChange={(e) => updateSupplier(i, { supplier_cost: Number(e.target.value) || 0 })} className={INPUT} />
                      </Field>
                      <Field label="Paid">
                        <input type="number" inputMode="decimal" value={s.paid_amount} onChange={(e) => updateSupplier(i, { paid_amount: Number(e.target.value) || 0 })} className={INPUT} />
                      </Field>
                      <Field label="Status">
                        <select value={s.payment_status} onChange={(e) => updateSupplier(i, { payment_status: e.target.value as FinanceOrderSupplier["payment_status"] })} className={INPUT}>
                          {(["unpaid","partial","paid","overdue"] as const).map((st) => <option key={st} value={st}>{st}</option>)}
                        </select>
                      </Field>
                      <Field label="Due">
                        <input type="date" value={s.due_date ?? ""} onChange={(e) => updateSupplier(i, { due_date: e.target.value || null })} className={INPUT} />
                      </Field>
                    </div>
                    <div className="mt-2 flex justify-end">
                      <button type="button" onClick={() => removeSupplier(i)} className="text-[11px] text-rose-400 hover:text-rose-300">Remove supplier</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <div className="mt-4">
          <SectionCard title="4 · Notes" subtitle="Anything operations or finance should remember about this order.">
            <textarea
              value={draft.order.notes}
              onChange={(e) => updateOrder("notes", e.target.value)}
              rows={3}
              placeholder="Internal notes — only visible to your team."
              className="w-full rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-3 py-2 text-sm placeholder-gray-600 focus:border-emerald-500/50 focus:outline-none"
            />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

const INPUT = "w-full rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-3 py-2 text-sm placeholder-gray-600 focus:border-emerald-500/50 focus:outline-none";

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`flex flex-col gap-1 ${wide ? "col-span-2" : ""}`}>
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500">{label}</span>
      {children}
    </label>
  );
}

function PreviewRow({ label, value, currency, accent, negative, percent }: { label: string; value: number; currency: string; accent: "emerald" | "rose" | "sky" | "violet" | "amber"; negative?: boolean; percent?: boolean }) {
  const color =
    accent === "emerald" ? "text-emerald-400"
    : accent === "rose"  ? "text-rose-400"
    : accent === "sky"   ? "text-sky-400"
    : accent === "violet"? "text-violet-400"
    : "text-amber-400";
  const display = percent ? `${value.toFixed(1)}%` : fmtMoney(value, currency, { compact: true });
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-gray-400">{label}</span>
      <span className={`tabular-nums font-semibold ${color}`}>{negative && value > 0 ? "−" : ""}{display}</span>
    </div>
  );
}
