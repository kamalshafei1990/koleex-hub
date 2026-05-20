"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import FinanceHeader from "@/components/finance/FinanceHeader";
import { useTranslation } from "@/lib/i18n";
import { financeT } from "@/lib/translations/finance";
import { EmptyState, SectionCard, StatusBadge } from "@/components/finance/FinanceUi";
import { HeroKpiCard, MetricCard } from "@/components/finance/FinanceUiX";
import { fmtMoney } from "@/lib/finance/calc";
import type { ApprovalStatus, FinancePayment, ReconciliationStatus } from "@/lib/finance/types";
/* Phase 2.3 — payment control. */
import { ApprovalBadge } from "@/components/approval/ApprovalBadge";
import { ReconciliationBadge } from "@/components/payment/ReconciliationBadge";
import PaymentReviewDrawer from "@/components/payment/PaymentReviewDrawer";
import GuidanceTip from "@/components/ui/GuidanceTip";
import { useBaseCurrency } from "@/lib/hooks/useBaseCurrency";

export default function FinancePayments() {
  const { t } = useTranslation(financeT);
  const baseCurrency = useBaseCurrency();
  const [rows, setRows] = useState<FinancePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<FinancePayment> | null>(null);
  /* Phase 2.3 — review drawer + approver-permission state. */
  const [reviewPayment, setReviewPayment] = useState<FinancePayment | null>(null);
  const [canApprove, setCanApprove] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/me/permitted-modules", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        const modules = (j.modules ?? []) as string[];
        setCanApprove(!!j.is_super_admin || modules.includes("Finance"));
      })
      .catch(() => { /* default false */ });
    return () => { cancelled = true; };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/finance/payments", { cache: "no-store" });
      const j = (await r.json()) as { payments?: FinancePayment[] };
      setRows(j.payments ?? []);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const kpi = useMemo(() => {
    const inComp = rows.filter((p) => p.direction === "in" && p.status === "completed").reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const outComp = rows.filter((p) => p.direction === "out" && p.status === "completed").reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const pending = rows.filter((p) => p.status === "pending").reduce((s, p) => s + (Number(p.amount) || 0), 0);
    return { inComp, outComp, pending, net: inComp - outComp };
  }, [rows]);

  const startNew = (direction: FinancePayment["direction"]) => setEditing({
    direction,
    party_type: direction === "in" ? "customer" : "supplier",
    party_name: "",
    amount: 0,
    currency: baseCurrency,
    payment_date: new Date().toISOString().slice(0, 10),
    status: "completed",
    payment_method: "T/T",
  });

  const save = async () => {
    if (!editing?.amount || !editing.party_name?.trim()) {
      alert(t("payments.err.missing", "Please add a party name and amount."));
      return;
    }
    const r = await fetch("/api/finance/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });
    if (!r.ok) { alert(t("payments.err.saveFailed", "Save failed")); return; }
    setEditing(null);
    void load();
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
        <FinanceHeader
          title={t("payments.title", "Payments")}
          subtitle={t("payments.subtitle", "Money in from customers and money out to suppliers — partial, full, pending, all in one ledger.")}
          action={
            <div className="flex gap-2">
              <button onClick={() => startNew("in")} className="rounded-xl bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-500/30">{t("payments.action.in", "+ Customer Payment")}</button>
              <button onClick={() => startNew("out")} className="rounded-xl bg-rose-500/20 px-4 py-2 text-sm font-medium text-rose-400 hover:bg-rose-500/30">{t("payments.action.out", "+ Supplier Payment")}</button>
            </div>
          }
        />

        <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <HeroKpiCard
            label={t("payments.kpi.net", "Net Cash This View")}
            helpId="treasury.available"
            value={kpi.net}
            unit={baseCurrency}
            tone={kpi.net >= 0 ? "positive" : "negative"}
            hint={t("payments.kpi.netHint", "Money in minus money out")}
            loading={loading}
          />
          <HeroKpiCard
            label={t("payments.kpi.pending", "Pending")}
            helpId="treasury.pending"
            value={kpi.pending}
            unit={baseCurrency}
            tone="warning"
            hint={t("payments.kpi.pendingHint", "Payments awaiting clearance")}
            loading={loading}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <MetricCard label={t("payments.kpi.in",  "Money In")}  helpId="finance.cashIn"  value={kpi.inComp}  unit={baseCurrency} hint={t("payments.kpi.inHint",  "From customers")} loading={loading} />
          <MetricCard label={t("payments.kpi.out", "Money Out")} helpId="finance.cashOut" value={kpi.outComp} unit={baseCurrency} hint={t("payments.kpi.outHint", "To suppliers + bills")} loading={loading} />
        </div>

        {editing && (
          <div className="mt-6">
            <SectionCard
              title={editing.direction === "in" ? t("payments.editor.titleIn", "Record customer payment") : t("payments.editor.titleOut", "Record supplier payment")}
              action={
                <div className="flex gap-2">
                  <button onClick={() => setEditing(null)} className="rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-3 py-1.5 text-xs font-medium text-gray-300 hover:border-white/[0.12]">{t("payments.editor.cancel", "Cancel")}</button>
                  <button onClick={save} className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/30">{t("payments.editor.save", "Save Payment")}</button>
                </div>
              }
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label={editing.direction === "in" ? t("payments.field.customer", "Customer name") : t("payments.field.supplier", "Supplier name")} wide>
                  <input value={editing.party_name ?? ""} onChange={(e) => setEditing({ ...editing, party_name: e.target.value })} className={INPUT} />
                </Field>
                <Field label={t("payments.field.amount", "Amount")}>
                  <input type="number" inputMode="decimal" value={editing.amount ?? 0} onChange={(e) => setEditing({ ...editing, amount: Number(e.target.value) || 0 })} className={INPUT} />
                </Field>
                <Field label={t("payments.field.currency", "Currency")}>
                  <select value={editing.currency ?? baseCurrency} onChange={(e) => setEditing({ ...editing, currency: e.target.value })} className={INPUT}>
                    {["USD","EUR","CNY","EGP","GBP"].map((c) => <option key={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label={t("payments.field.date", "Date")}>
                  <input type="date" value={editing.payment_date ?? ""} onChange={(e) => setEditing({ ...editing, payment_date: e.target.value })} className={INPUT} />
                </Field>
                <Field label={t("payments.field.method", "Method")}>
                  <select value={editing.payment_method ?? "T/T"} onChange={(e) => setEditing({ ...editing, payment_method: e.target.value })} className={INPUT}>
                    {["T/T","L/C","Cash","Cheque","Card","Other"].map((m) => <option key={m}>{m}</option>)}
                  </select>
                </Field>
                <Field label={t("payments.field.reference", "Reference")}>
                  <input value={editing.reference_no ?? ""} onChange={(e) => setEditing({ ...editing, reference_no: e.target.value })} placeholder={t("payments.field.referencePh", "Bank ref / cheque no.")} className={INPUT} />
                </Field>
                <Field label={t("payments.field.status", "Status")}>
                  <select value={editing.status ?? "completed"} onChange={(e) => setEditing({ ...editing, status: e.target.value as FinancePayment["status"] })} className={INPUT}>
                    {(["pending","completed","cancelled","bounced"] as const).map((s) => <option key={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label={t("payments.field.notes", "Notes")} wide>
                  <input value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} className={INPUT} />
                </Field>
              </div>
            </SectionCard>
          </div>
        )}

        <div className="mt-6">
          {loading ? (
            <SectionCard><div className="py-8 text-center text-sm text-gray-500">{t("payments.loading", "Loading payments…")}</div></SectionCard>
          ) : rows.length === 0 ? (
            <EmptyState
              title={t("payments.emptyTitle", "No payments recorded yet")}
              hint={t("payments.emptyHint", "Log every money movement — customer payments, supplier payments, banking fees.")}
              action={<button onClick={() => startNew("in")} className="rounded-xl bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-500/30">{t("payments.emptyAction", "+ Record First Payment")}</button>}
            />
          ) : (
            <SectionCard>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-[10px] uppercase tracking-wider text-gray-500">
                    <tr>
                      <th className="py-2 pr-3">{t("payments.col.date", "Date")}</th>
                      <th className="py-2 pr-3">
                        <span className="inline-flex items-center gap-1">
                          <span>{t("payments.col.direction", "Direction")}</span>
                          <GuidanceTip guidanceId="payment.direction" />
                        </span>
                      </th>
                      <th className="py-2 pr-3">
                        <span className="inline-flex items-center gap-1">
                          <span>{t("payments.col.party", "Party")}</span>
                          <GuidanceTip guidanceId="payment.party" />
                        </span>
                      </th>
                      <th className="py-2 pr-3">
                        <span className="inline-flex items-center gap-1">
                          <span>{t("payments.col.method", "Method")}</span>
                          <GuidanceTip guidanceId="payment.method" />
                        </span>
                      </th>
                      <th className="py-2 pr-3 text-right">{t("payments.col.amount", "Amount")}</th>
                      <th className="py-2 pr-3">
                        <span className="inline-flex items-center gap-1">
                          <span>{t("payments.col.status", "Status")}</span>
                          <GuidanceTip guidanceId="payment.movementStatus" />
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p) => (
                      <tr
                        key={p.id}
                        className="cursor-pointer border-t border-white/[0.04] transition hover:bg-white/[0.02]"
                        onClick={() => setReviewPayment(p)}
                      >
                        <td className="py-3 pr-3 text-gray-400 tabular-nums">{p.payment_date}</td>
                        <td className="py-3 pr-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${p.direction === "in" ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"}`}>
                            {p.direction === "in" ? t("payments.row.in", "Money in") : t("payments.row.out", "Money out")}
                          </span>
                        </td>
                        <td className="py-3 pr-3 font-medium">{p.party_name || "—"}</td>
                        <td className="py-3 pr-3 text-gray-400">{p.payment_method ?? "—"}</td>
                        <td className={`py-3 pr-3 text-right tabular-nums font-semibold ${p.direction === "in" ? "text-emerald-400" : "text-rose-400"}`}>
                          {p.direction === "in" ? "+" : "−"}{fmtMoney(Number(p.amount) || 0, p.currency, { compact: true })}
                        </td>
                        <td className="py-3 pr-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <StatusBadge status={p.status} />
                            <ApprovalBadge status={(p.approval_status ?? "draft") as ApprovalStatus} compact />
                            <ReconciliationBadge status={(p.reconciliation_status ?? "unreconciled") as ReconciliationStatus} compact />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}
        </div>
      </div>

      <PaymentReviewDrawer
        open={!!reviewPayment}
        onClose={() => setReviewPayment(null)}
        payment={reviewPayment}
        canApprove={canApprove}
        onChange={(next) => {
          setReviewPayment(next);
          void load();
        }}
      />
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
