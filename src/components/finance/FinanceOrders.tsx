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
import PartyPickerModal, { type FinancePartyRow } from "@/components/finance/PartyPickerModal";
import PartyChip, { type PartyChipData } from "@/components/finance/PartyChip";
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
    const totalCollected = orders.reduce((s, o) => s + (o.collected_amount ?? 0), 0);
    const totalOutstanding = orders.reduce((s, o) => s + (o.outstanding_receivable ?? 0), 0);
    const avgMargin = totalSelling > 0 ? (totalNet / totalSelling) * 100 : 0;
    return { totalSelling, totalNet, totalCollected, totalOutstanding, avgMargin };
  }, [orders]);

  const startNew = () => {
    setDraft({
      order: {
        id: undefined,
        order_no: "",
        customer_id: null,
        customer_name: "",
        order_date: new Date().toISOString().slice(0, 10),
        currency: "USD",
        selling_price: 0,
        tax_refund_pct: 0,
        tax_refund_value: 0,
        financial_charges: 0,
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
        customer_id: o.customer_id,
        customer_name: o.customer_name,
        order_date: o.order_date,
        currency: o.currency,
        selling_price: o.selling_price,
        tax_refund_pct: o.tax_refund_pct,
        tax_refund_value: o.tax_refund_value,
        financial_charges: o.financial_charges ?? 0,
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
    return (
      <OrderEditor
        draft={draft}
        setDraft={setDraft}
        onCancel={() => { setView("list"); setDraft(null); }}
        onSave={save}
      />
    );
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
  const ccy = order.currency || "USD";
  const sellingPrice = order.selling_price ?? 0;
  const supplierCost = order.total_supplier_cost ?? 0;
  const expenses = order.total_order_expenses ?? 0;
  const taxRefund = order.tax_refund_value ?? 0;
  const finCharges = order.financial_charges ?? 0;
  const grossProfit = order.gross_profit ?? 0;
  const netProfit = order.net_profit ?? 0;
  const netPct = order.net_profit_pct ?? 0;

  /* Cash picture */
  const collected = order.collected_amount ?? 0;
  const paidSupplier = order.paid_supplier_amount ?? 0;
  const paidExpenses = order.paid_expenses ?? 0;
  const realizedCash = order.realized_cash_position ?? 0;
  const outstandingAR = order.outstanding_receivable ?? 0;
  const outstandingAP = order.outstanding_payable ?? 0;

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

      {/* Profit waterfall row — Revenue → Net Profit */}
      <div className="mt-4 rounded-lg border border-white/[0.04] bg-[var(--bg-primary)] p-3">
        <div className="mb-2 text-[10px] uppercase tracking-wider text-gray-500">Expected profit (booked)</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-7">
          <Stat label="Revenue"        value={fmtMoney(sellingPrice, ccy, { compact: true })} accent="emerald" />
          <Stat label="− Supplier"     value={fmtMoney(supplierCost, ccy, { compact: true })} accent="rose" />
          <Stat label="= Gross profit" value={fmtMoney(grossProfit, ccy, { compact: true })} accent={grossProfit >= 0 ? "sky" : "rose"} />
          <Stat label="− Order expenses" value={fmtMoney(expenses, ccy, { compact: true })} accent="rose" />
          <Stat label="+ Tax refund"   value={fmtMoney(taxRefund, ccy, { compact: true })} accent="emerald" />
          <Stat label="− Bank charges" value={fmtMoney(finCharges, ccy, { compact: true })} accent="rose" />
          <Stat label={`Net (${fmtPct(netPct)})`} value={fmtMoney(netProfit, ccy, { compact: true })} accent={netProfit >= 0 ? "violet" : "rose"} />
        </div>
      </div>

      {/* Cash position row — actual money moved */}
      <div className="mt-3 rounded-lg border border-white/[0.04] bg-[var(--bg-primary)] p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-wider text-gray-500">Realized cash position</div>
          <div className="text-[10px] text-gray-500">Collected − Paid supplier − Paid expenses</div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Stat label="Collected"        value={fmtMoney(collected, ccy, { compact: true })} accent="emerald" />
          <Stat label="Paid supplier"    value={fmtMoney(paidSupplier, ccy, { compact: true })} accent="rose" />
          <Stat label="Paid expenses"    value={fmtMoney(paidExpenses, ccy, { compact: true })} accent="rose" />
          <Stat label="AR (to collect)"  value={fmtMoney(outstandingAR, ccy, { compact: true })} accent="amber" />
          <Stat label="AP (to pay)"      value={fmtMoney(outstandingAP, ccy, { compact: true })} accent="amber" />
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px] text-gray-400">
          <span>Cash result so far</span>
          <span className={`font-semibold tabular-nums ${realizedCash >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {realizedCash < 0 ? "−" : ""}{fmtMoney(Math.abs(realizedCash), ccy, { compact: true })}
          </span>
        </div>
        <div className="mt-1.5">
          <ProgressBar value={collected} max={sellingPrice} color={collected >= sellingPrice ? "emerald" : "amber"} />
        </div>
      </div>

      {order.suppliers && order.suppliers.length > 0 && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
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

function Stat({ label, value, negative, accent }: { label: string; value: string; negative?: boolean; accent?: "emerald" | "rose" | "amber" | "sky" | "violet" }) {
  const color =
    accent === "emerald" ? "text-emerald-400"
    : accent === "rose"  ? "text-rose-400"
    : accent === "amber" ? "text-amber-400"
    : accent === "sky"   ? "text-sky-400"
    : accent === "violet"? "text-violet-400"
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
    customer_id: string | null;            // contacts.id (UUID) from PartyPicker
    customer_name: string;                 // denormalised display name
    order_date: string;
    currency: string;
    selling_price: number;
    tax_refund_pct: number;
    tax_refund_value: number;
    financial_charges: number;
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
    financial_charges: Number(draft.order.financial_charges) || 0,
    suppliers: draft.suppliers,
    linked_expenses: [],
    customer_payments_total: 0,
  });

  /* Picker state — held outside DraftOrder so meta (flag, tier, photo)
     never leaks into the saved payload. Keyed by contact id. */
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [supplierPickerIndex, setSupplierPickerIndex] = useState<number | null>(null);
  const [partyMeta, setPartyMeta] = useState<Map<string, FinancePartyRow>>(() => new Map());

  const updateOrder = <K extends keyof DraftOrder["order"]>(k: K, v: DraftOrder["order"][K]) => {
    setDraft({ ...draft, order: { ...draft.order, [k]: v } });
  };
  const addSupplier = () => setDraft({ ...draft, suppliers: [...draft.suppliers, { ...EMPTY_SUPPLIER, currency: draft.order.currency }] });
  const removeSupplier = (i: number) => setDraft({ ...draft, suppliers: draft.suppliers.filter((_, idx) => idx !== i) });
  const updateSupplier = (i: number, patch: Partial<DraftOrder["suppliers"][number]>) => {
    setDraft({ ...draft, suppliers: draft.suppliers.map((s, idx) => idx === i ? { ...s, ...patch } : s) });
  };

  /* Smart defaults — when a customer is picked, copy the customer's
     default currency + payment terms into the order if they're still
     blank. The operator can override afterwards. */
  const applyCustomerPick = (row: FinancePartyRow) => {
    setPartyMeta((m) => {
      const next = new Map(m);
      next.set(row.id, row);
      return next;
    });
    const next: DraftOrder = {
      ...draft,
      order: {
        ...draft.order,
        customer_id: row.id,
        customer_name: row.display_name || row.company || draft.order.customer_name,
        currency: draft.order.currency === "USD" && row.default_currency ? row.default_currency : draft.order.currency,
      },
    };
    setDraft(next);
    setCustomerPickerOpen(false);
  };

  const applySupplierPick = (i: number, row: FinancePartyRow) => {
    setPartyMeta((m) => {
      const next = new Map(m);
      next.set(row.id, row);
      return next;
    });
    setDraft({
      ...draft,
      suppliers: draft.suppliers.map((s, idx) =>
        idx === i
          ? {
              ...s,
              supplier_id: row.id,
              supplier_name: row.display_name || row.company || s.supplier_name,
              currency: row.default_currency || s.currency || draft.order.currency,
            }
          : s,
      ),
    });
    setSupplierPickerIndex(null);
  };

  /* Lightweight party data builders for PartyChip — pulls meta from
     the cache if present, falls back to whatever's on the draft. */
  const customerChipData: PartyChipData | null = draft.order.customer_id || draft.order.customer_name
    ? (() => {
        const meta = draft.order.customer_id ? partyMeta.get(draft.order.customer_id) : null;
        return meta
          ? {
              id: meta.id,
              name: meta.display_name,
              company: meta.company,
              country_code: meta.country_code,
              customer_tier: meta.customer_tier,
              photo_url: meta.photo_url,
              payment_terms: meta.payment_terms,
              credit_status: meta.credit_status,
            }
          : { name: draft.order.customer_name };
      })()
    : null;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Picker modals */}
      <PartyPickerModal
        open={customerPickerOpen}
        type="customer"
        onClose={() => setCustomerPickerOpen(false)}
        onPick={applyCustomerPick}
      />
      <PartyPickerModal
        open={supplierPickerIndex !== null}
        type="supplier"
        onClose={() => setSupplierPickerIndex(null)}
        onPick={(row) => supplierPickerIndex !== null && applySupplierPick(supplierPickerIndex, row)}
      />

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

        {/* Step indicator */}
        <div className="mt-6 flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { n: 1, label: "Customer & Selling", done: !!draft.order.customer_id || !!draft.order.customer_name?.trim(), active: !draft.order.customer_id && !draft.order.customer_name?.trim() },
            { n: 2, label: "Suppliers & Costs",  done: draft.suppliers.some((s) => s.supplier_cost > 0),                                          active: false },
            { n: 3, label: "Tax & Charges",      done: !!draft.order.tax_refund_pct || !!draft.order.tax_refund_value,                            active: false },
            { n: 4, label: "Save & Track",       done: !!draft.order.id,                                                                          active: false },
          ].map((s) => (
            <div key={s.n} className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium ${s.done ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : s.active ? "border-sky-500/40 bg-sky-500/10 text-sky-300" : "border-white/[0.06] bg-[var(--bg-secondary)] text-gray-400"}`}>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full ${s.done ? "bg-emerald-500/30" : "bg-white/5"}`}>
                {s.done ? "✓" : s.n}
              </span>
              <span className="whitespace-nowrap">Step {s.n} · {s.label}</span>
            </div>
          ))}
        </div>

        {/* Order header */}
        <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <SectionCard title="Step 1 · Customer & Selling" subtitle="Pick a customer from Contacts — currency and terms auto-fill.">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Customer" wide>
                <PartyChip
                  party={customerChipData}
                  onChange={() => setCustomerPickerOpen(true)}
                  onClear={() => updateOrder("customer_id", null)}
                  placeholder="Pick a customer from Contacts…"
                />
              </Field>
              <Field label="Order No.">
                <input value={draft.order.order_no} onChange={(e) => updateOrder("order_no", e.target.value)} placeholder="Auto on save" className={INPUT} />
              </Field>
              <Field label="Order date">
                <input type="date" value={draft.order.order_date} onChange={(e) => updateOrder("order_date", e.target.value)} className={INPUT} />
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

          <SectionCard title="Step 3 · Money in & Tax" subtitle="Selling price, tax refund, bank charges, due date.">
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
              <Field label="Bank / L-C / FX charges">
                <input type="number" inputMode="decimal" value={draft.order.financial_charges} onChange={(e) => updateOrder("financial_charges", Number(e.target.value) || 0)} placeholder="0.00" className={INPUT} />
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
            <p className="mt-3 rounded-lg border border-sky-500/20 bg-sky-500/[0.04] px-3 py-2 text-[11px] text-sky-200">
              Gross profit excludes tax refund. Tax refund is calculated separately and added back before net profit.
            </p>
          </SectionCard>

          <SectionCard title="Profit preview" subtitle="Updates live as you type.">
            <PreviewRow label="Revenue"            value={sellingPrice} currency={draft.order.currency} accent="emerald" />
            <PreviewRow label="− Supplier cost"    value={profit.total_supplier_cost} currency={draft.order.currency} accent="rose" negative />
            <div className="my-1.5 border-t border-white/5" />
            <PreviewRow label="= Gross profit"     value={profit.gross_profit} currency={draft.order.currency} accent={profit.gross_profit >= 0 ? "sky" : "rose"} />
            <div className="my-1.5 border-t border-white/5" />
            <PreviewRow label="− Order expenses (linked)" value={profit.total_order_expenses} currency={draft.order.currency} accent="rose" negative />
            <PreviewRow label="+ Tax refund"       value={taxValue} currency={draft.order.currency} accent="emerald" />
            <PreviewRow label="− Bank / L-C charges" value={profit.financial_charges} currency={draft.order.currency} accent="rose" negative />
            <div className="my-1.5 border-t border-white/5" />
            <PreviewRow label="= Net profit"       value={profit.net_profit} currency={draft.order.currency} accent="violet" />
            <PreviewRow label="Margin"             value={profit.net_profit_pct} currency="%" accent={profit.net_profit_pct >= 15 ? "emerald" : profit.net_profit_pct >= 0 ? "amber" : "rose"} percent />
            <p className="mt-3 rounded-md bg-white/5 px-2 py-1.5 text-[10px] leading-relaxed text-gray-400">
              This is the <strong>expected</strong> profit (booked).
              The <strong>realized cash result</strong> is tracked on the order card after save —
              it uses actual collected payments and paid costs, not a ratio.
            </p>
          </SectionCard>
        </div>

        {/* Suppliers */}
        <div className="mt-4">
          <SectionCard
            title="Step 2 · Suppliers & Costs"
            subtitle="Pick each supplier from Contacts. The total supplier cost is the sum of these lines — gross profit updates live."
            action={
              <button type="button" onClick={addSupplier} className="rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-3 py-1.5 text-xs font-medium text-gray-200 hover:border-white/[0.12]">+ Add Supplier</button>
            }
          >
            {draft.suppliers.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-500">No suppliers yet. Click + Add Supplier to record a cost.</div>
            ) : (
              <div className="space-y-3">
                {draft.suppliers.map((s, i) => {
                  const sMeta = s.supplier_id ? partyMeta.get(s.supplier_id) : null;
                  const sChip: PartyChipData | null = (s.supplier_id || s.supplier_name)
                    ? (sMeta
                        ? { id: sMeta.id, name: sMeta.display_name, company: sMeta.company, country_code: sMeta.country_code, customer_tier: null, photo_url: sMeta.photo_url, payment_terms: sMeta.payment_terms }
                        : { name: s.supplier_name })
                    : null;
                  return (
                    <div key={i} className="rounded-xl border border-white/[0.04] bg-[var(--bg-primary)] p-3">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
                        <div className="sm:col-span-2">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500">Supplier</div>
                          <div className="mt-1">
                            <PartyChip
                              party={sChip}
                              onChange={() => setSupplierPickerIndex(i)}
                              onClear={() => updateSupplier(i, { supplier_id: null, supplier_name: "" })}
                              placeholder="Pick a supplier from Contacts…"
                              compact
                            />
                          </div>
                        </div>
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
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>

        <div className="mt-4">
          <SectionCard title="Step 4 · Notes & Save" subtitle="Anything operations or finance should remember about this order. Hit Save when ready.">
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
