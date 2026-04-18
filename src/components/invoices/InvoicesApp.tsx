"use client";

/* ---------------------------------------------------------------------------
   InvoicesApp — Hub-native billing app. Mirrors Odoo Invoicing's core
   shape (list + detail with line editor + payment tracking) in the
   Koleex design system.

   Views:
     • Invoices list           — KPI strip + filter chips + table
     • Invoice detail          — header, billing info, line editor,
                                 totals, payments, action bar
     • Invoice form modal      — create new invoice
     • Payment modal           — record a payment against an invoice
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { invoicesT } from "@/lib/translations/invoices";
import { ScrollLockOverlay } from "@/hooks/useScrollLock";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import PaperPlaneIcon from "@/components/icons/ui/PaperPlaneIcon";
import CheckCircleIcon from "@/components/icons/ui/CheckCircleIcon";
import DownloadIcon from "@/components/icons/ui/DownloadIcon";
import InvoicesIcon from "@/components/icons/InvoicesIcon";
import EntityPicker from "@/components/planning/EntityPicker";
import {
  createInvoice,
  deleteInvoice,
  fetchInvoice,
  fetchInvoices,
  formatMoney,
  isOverdue,
  recordPayment,
  saveInvoiceLines,
  sendInvoice,
  STATUS_COLOR,
  updateInvoice,
  type InvoiceItem,
  type InvoicePayment,
  type InvoiceRow,
  type InvoiceStatus,
} from "@/lib/invoices";

export default function InvoicesApp() {
  const [activeId, setActiveId] = useState<string | null>(null);

  if (activeId) {
    return <InvoiceDetailView invoiceId={activeId} onBack={() => setActiveId(null)} />;
  }

  return <InvoiceListView onOpen={setActiveId} />;
}

/* ══════════════════════════════════════════════════════════════════
   LIST VIEW
   ══════════════════════════════════════════════════════════════════ */

function InvoiceListView({ onOpen }: { onOpen: (id: string) => void }) {
  const { t } = useTranslation(invoicesT);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<InvoiceStatus | "all" | "open">("open");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const res = await fetchInvoices({
      status: filter === "open" ? undefined : filter === "all" ? "all" : filter,
      search: search.trim() || undefined,
    });
    setInvoices(res);
    setLoading(false);
  }, [filter, search]);

  useEffect(() => {
    reload();
  }, [reload]);

  const visible = useMemo(() => {
    if (filter !== "open") return invoices;
    // "Open" = anything still owed money on
    return invoices.filter(
      (i) => !["paid", "cancelled", "void"].includes(i.status) && i.balance > 0,
    );
  }, [invoices, filter]);

  const kpi = useMemo(() => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    let outstanding = 0;
    let overdue = 0;
    let paidThisMonth = 0;
    for (const inv of invoices) {
      if (!["paid", "cancelled", "void"].includes(inv.status)) {
        outstanding += Number(inv.balance || 0);
        if (isOverdue(inv)) overdue += Number(inv.balance || 0);
      }
      if (inv.paid_at && new Date(inv.paid_at) >= monthStart) {
        paidThisMonth += Number(inv.total || 0);
      }
    }
    return {
      outstanding,
      overdue,
      paidThisMonth,
      count: invoices.length,
    };
  }, [invoices]);

  return (
    <div
      className="bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col overflow-hidden w-full"
      style={{ height: "calc(100dvh - 3.5rem)" }}
    >
      {/* Header */}
      <div className="shrink-0 bg-[var(--bg-primary)] border-b border-[var(--border-subtle)] z-10 w-full overflow-x-hidden">
        <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 min-w-0">
          <div className="flex flex-wrap items-center gap-3 pt-5 pb-1">
            <Link
              href="/"
              className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] shrink-0"
            >
              <ArrowLeftIcon className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0">
                <InvoicesIcon className="h-4 w-4" />
              </div>
              <h1 className="text-xl md:text-[22px] font-bold tracking-tight truncate">
                {t("app.title")}
              </h1>
            </div>
            <button
              onClick={() => setFormOpen(true)}
              className="h-9 px-4 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 shrink-0"
            >
              <PlusIcon size={14} />
              <span className="hidden sm:inline">{t("action.new")}</span>
            </button>
          </div>
          <p className="text-[12px] text-[var(--text-dim)] mb-3 ml-0 md:ml-11">
            {t("app.subtitle")}
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto w-full">
        <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-4 min-w-0 space-y-4">
          {/* KPI strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label={t("kpi.outstanding")} value={formatMoney(kpi.outstanding)} accent="text-amber-400" />
            <KpiCard label={t("kpi.overdue")} value={formatMoney(kpi.overdue)} accent="text-rose-400" />
            <KpiCard label={t("kpi.paidThisMonth")} value={formatMoney(kpi.paidThisMonth)} accent="text-emerald-400" />
            <KpiCard label={t("kpi.count")} value={String(kpi.count)} accent="text-blue-400" />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("list.search")}
              className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] outline-none focus:border-[var(--border-focus)] w-full sm:w-64"
            />
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
              {(["open", "all", "draft", "sent", "partial", "paid", "overdue"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilter(s as InvoiceStatus | "all" | "open")}
                  className={`h-7 px-3 rounded-full text-[11px] font-semibold border whitespace-nowrap transition-colors ${
                    filter === s
                      ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-transparent"
                      : "bg-transparent border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {s === "open" && t("filter.open")}
                  {s === "all" && t("filter.all")}
                  {["draft", "sent", "partial", "paid", "overdue"].includes(s) && t(`status.${s}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <SpinnerIcon className="h-5 w-5 text-[var(--text-dim)] animate-spin" />
            </div>
          ) : visible.length === 0 ? (
            <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] py-14 text-center text-[13px] text-[var(--text-dim)]">
              {t("empty.list")}
            </div>
          ) : (
            <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] overflow-hidden">
              <div className="hidden md:grid grid-cols-[120px_1.5fr_120px_120px_100px_120px_120px] gap-2 px-4 py-2.5 border-b border-[var(--border-subtle)] text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
                <div>{t("detail.invoice")} #</div>
                <div>{t("form.customer")}</div>
                <div>{t("form.issueDate")}</div>
                <div>{t("form.dueDate")}</div>
                <div className="text-end">{t("status.draft").replace("Draft","Status")}</div>
                <div className="text-end">{t("list.total")}</div>
                <div className="text-end">{t("list.balance")}</div>
              </div>
              {visible.map((inv) => {
                const overdue = isOverdue(inv);
                const effectiveStatus: InvoiceStatus = overdue ? "overdue" : inv.status;
                const customerName = inv.customer?.display_name ?? inv.customer?.company_name ?? "—";
                return (
                  <button
                    key={inv.id}
                    onClick={() => onOpen(inv.id)}
                    className="w-full text-start grid grid-cols-[1fr_auto] md:grid-cols-[120px_1.5fr_120px_120px_100px_120px_120px] gap-2 px-4 py-3 border-b last:border-b-0 border-[var(--border-subtle)] hover:bg-[var(--bg-surface-subtle)] transition-colors"
                  >
                    <div className="text-[12px] font-bold text-[var(--text-primary)] truncate">
                      {inv.inv_no ?? "—"}
                    </div>
                    <div className="text-[12px] text-[var(--text-muted)] truncate hidden md:block">
                      {customerName}
                    </div>
                    <div className="text-[11px] text-[var(--text-dim)] hidden md:block">
                      {inv.issue_date}
                    </div>
                    <div className={`text-[11px] hidden md:block ${overdue ? "text-rose-400 font-semibold" : "text-[var(--text-dim)]"}`}>
                      {inv.due_date ?? "—"}
                    </div>
                    <div className="hidden md:flex items-center justify-end">
                      <StatusPill status={effectiveStatus} />
                    </div>
                    <div className="text-[12px] font-semibold text-[var(--text-primary)] text-end hidden md:block">
                      {formatMoney(inv.total, inv.currency)}
                    </div>
                    <div className={`text-[12px] font-bold text-end hidden md:block ${inv.balance > 0 ? "text-[var(--text-primary)]" : "text-[var(--text-dim)]"}`}>
                      {formatMoney(inv.balance, inv.currency)}
                    </div>
                    {/* Mobile collapse */}
                    <div className="md:hidden text-[11px] text-[var(--text-dim)] truncate">
                      {customerName} · {inv.issue_date}
                    </div>
                    <div className="md:hidden flex items-center gap-2 col-span-2 justify-between mt-1">
                      <StatusPill status={effectiveStatus} />
                      <div className="text-[12px] font-bold text-[var(--text-primary)]">
                        {formatMoney(inv.balance, inv.currency)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <InvoiceFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onCreated={(id) => { setFormOpen(false); onOpen(id); }}
      />
    </div>
  );
}

function KpiCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)] mb-2">
        {label}
      </div>
      <div className={`text-[20px] md:text-[22px] font-bold leading-none ${accent}`}>{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: InvoiceStatus }) {
  const { t } = useTranslation(invoicesT);
  const color = STATUS_COLOR[status];
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: `${color}22`, color }}
    >
      <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {t(`status.${status}`)}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════
   DETAIL VIEW
   ══════════════════════════════════════════════════════════════════ */

function InvoiceDetailView({
  invoiceId,
  onBack,
}: {
  invoiceId: string;
  onBack: () => void;
}) {
  const { t } = useTranslation(invoicesT);
  const [state, setState] = useState<{
    invoice: InvoiceRow;
    items: InvoiceItem[];
    payments: InvoicePayment[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [lines, setLines] = useState<Partial<InvoiceItem>[]>([]);
  const [headerTax, setHeaderTax] = useState(0);
  const [headerDisc, setHeaderDisc] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const data = await fetchInvoice(invoiceId);
    if (data) {
      setState(data);
      setLines(data.items);
      setHeaderTax(Number(data.invoice.tax_rate ?? 0));
      setHeaderDisc(Number(data.invoice.discount_percent ?? 0));
      setDirty(false);
    }
    setLoading(false);
  }, [invoiceId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const liveTotals = useMemo(() => {
    let subtotal = 0;
    let lineDisc = 0;
    let lineTax = 0;
    lines.forEach((l) => {
      const gross = Number(l.qty ?? 0) * Number(l.unit_price ?? 0);
      const disc = (gross * Number(l.line_discount_percent ?? 0)) / 100;
      const net = gross - disc;
      const tx = (net * Number(l.tax_rate ?? 0)) / 100;
      subtotal += gross;
      lineDisc += disc;
      lineTax += tx;
    });
    const afterLineDisc = subtotal - lineDisc;
    const headerDiscAmt = (afterLineDisc * headerDisc) / 100;
    const net = afterLineDisc - headerDiscAmt;
    const headerTaxAmt = (net * headerTax) / 100;
    const discount_total = lineDisc + headerDiscAmt;
    const tax_total = lineTax + headerTaxAmt;
    const total = net + tax_total;
    return {
      subtotal,
      discount_total,
      tax_total,
      total,
      balance: total - Number(state?.invoice.amount_paid ?? 0),
    };
  }, [lines, headerTax, headerDisc, state?.invoice.amount_paid]);

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        qty: 1,
        unit_price: 0,
        tax_rate: 0,
        line_discount_percent: 0,
        description: "",
      },
    ]);
    setDirty(true);
  };

  const updateLine = (i: number, patch: Partial<InvoiceItem>) => {
    setLines((prev) => {
      const next = prev.slice();
      next[i] = { ...next[i], ...patch };
      return next;
    });
    setDirty(true);
  };

  const removeLine = (i: number) => {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
    setDirty(true);
  };

  const saveLines = async () => {
    const res = await saveInvoiceLines(invoiceId, {
      lines: lines.map((l, idx) => ({
        product_id: l.product_id ?? null,
        description: l.description ?? null,
        qty: Number(l.qty ?? 0),
        unit_price: Number(l.unit_price ?? 0),
        tax_rate: Number(l.tax_rate ?? 0),
        line_discount_percent: Number(l.line_discount_percent ?? 0),
        sort_order: idx,
      })),
      tax_rate: headerTax,
      discount_percent: headerDisc,
    });
    if (res) {
      setState((prev) => (prev ? { ...prev, invoice: res.invoice, items: res.items } : prev));
      setLines(res.items);
      setDirty(false);
    }
  };

  const send = async () => {
    if (dirty) await saveLines();
    const updated = await sendInvoice(invoiceId);
    if (updated) setState((prev) => (prev ? { ...prev, invoice: updated } : prev));
  };

  const markPaid = async () => {
    // One-click: record a payment for the full balance, then reload.
    const bal = Number(state?.invoice.balance ?? 0);
    if (bal > 0) {
      await recordPayment(invoiceId, { amount: bal, method: "other", notes: "Marked as paid" });
      await reload();
    } else {
      const updated = await updateInvoice(invoiceId, { status: "paid" });
      if (updated) setState((prev) => (prev ? { ...prev, invoice: updated } : prev));
    }
  };

  const del = async () => {
    if (!confirm(t("confirm.delete"))) return;
    await deleteInvoice(invoiceId);
    onBack();
  };

  if (loading || !state) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <SpinnerIcon className="h-5 w-5 text-[var(--text-dim)] animate-spin" />
      </div>
    );
  }

  const inv = state.invoice;
  const customerName = inv.customer?.display_name ?? inv.customer?.company_name ?? "—";
  const overdue = isOverdue(inv);
  const effectiveStatus: InvoiceStatus = overdue ? "overdue" : inv.status;
  const cur = inv.currency || "USD";

  return (
    <div
      className="bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col overflow-hidden w-full"
      style={{ height: "calc(100dvh - 3.5rem)" }}
    >
      <div className="shrink-0 bg-[var(--bg-primary)] border-b border-[var(--border-subtle)] z-10 w-full overflow-x-hidden print:hidden">
        <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 min-w-0">
          <div className="flex items-center gap-3 pt-4 pb-3 flex-wrap">
            <button
              onClick={onBack}
              className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] shrink-0"
            >
              <ArrowLeftIcon className="h-4 w-4" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-[18px] md:text-[20px] font-bold tracking-tight truncate flex items-center gap-2">
                {t("detail.invoice")} {inv.inv_no}
                <StatusPill status={effectiveStatus} />
              </h1>
              <div className="text-[11px] text-[var(--text-dim)] truncate">
                {customerName} · {inv.issue_date}{inv.due_date ? ` → ${inv.due_date}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {dirty && (
                <button
                  onClick={saveLines}
                  className="h-9 px-3 rounded-lg border border-amber-500/40 text-amber-400 text-[12px] font-semibold hover:bg-amber-500/10"
                >
                  {t("btn.save")}
                </button>
              )}
              {inv.status === "draft" && (
                <button
                  onClick={send}
                  className="h-9 px-3 rounded-lg border border-blue-500/40 text-blue-400 text-[12px] font-semibold hover:bg-blue-500/10 flex items-center gap-1.5"
                >
                  <PaperPlaneIcon size={12} /> {t("btn.markSent")}
                </button>
              )}
              {!["paid", "cancelled", "void"].includes(inv.status) && (
                <button
                  onClick={() => setPayOpen(true)}
                  className="h-9 px-3 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold flex items-center gap-1.5 hover:opacity-90"
                >
                  <CheckCircleIcon size={12} /> {t("btn.recordPayment")}
                </button>
              )}
              {inv.status !== "paid" && inv.balance === 0 && (
                <button
                  onClick={markPaid}
                  className="h-9 px-3 rounded-lg border border-emerald-500/40 text-emerald-400 text-[12px] font-semibold hover:bg-emerald-500/10"
                >
                  {t("btn.markPaid")}
                </button>
              )}
              <button
                onClick={() => window.print()}
                className="h-9 w-9 rounded-lg border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center"
                title={t("btn.print")}
              >
                <DownloadIcon className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={del}
                className="h-9 w-9 rounded-lg border border-[var(--border-subtle)] text-rose-400 hover:bg-rose-500/10 flex items-center justify-center"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto w-full">
        <div className="max-w-[1100px] mx-auto px-4 md:px-6 lg:px-8 py-4 min-w-0 space-y-4">
          {/* Bill-to card */}
          <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <DetailField label={t("detail.billTo")} value={customerName} />
              <DetailField label={t("form.issueDate")} value={inv.issue_date} />
              <DetailField label={t("form.dueDate")} value={inv.due_date ?? "—"} />
            </div>
          </div>

          {/* Line editor */}
          <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] overflow-hidden">
            <div className="hidden md:grid grid-cols-[1.6fr_70px_110px_70px_70px_110px_40px] gap-2 px-3 py-2.5 border-b border-[var(--border-subtle)] text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
              <div>{t("line.description")}</div>
              <div className="text-end">{t("line.qty")}</div>
              <div className="text-end">{t("line.price")}</div>
              <div className="text-end">{t("line.tax")}</div>
              <div className="text-end">{t("line.disc")}</div>
              <div className="text-end">{t("line.total")}</div>
              <div />
            </div>
            {lines.length === 0 ? (
              <div className="px-6 py-8 text-center text-[12px] text-[var(--text-dim)]">
                {t("empty.lines")}
              </div>
            ) : (
              lines.map((l, i) => (
                <LineEditor
                  key={l.id ?? `new-${i}`}
                  line={l}
                  currency={cur}
                  onChange={(patch) => updateLine(i, patch)}
                  onRemove={() => removeLine(i)}
                />
              ))
            )}
            <div className="px-3 py-2 border-t border-[var(--border-subtle)]">
              <button
                onClick={addLine}
                className="h-8 px-3 rounded-lg border border-dashed border-[var(--border-subtle)] text-[11px] font-semibold text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center gap-1.5"
              >
                <PlusIcon size={11} /> {t("line.add")}
              </button>
            </div>
          </div>

          {/* Totals + header tax/discount */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
            <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4 space-y-3">
              <Field label={t("form.notes")}>
                <textarea
                  value={inv.notes ?? ""}
                  onChange={async (e) => {
                    const updated = await updateInvoice(invoiceId, { notes: e.target.value });
                    if (updated) setState((prev) => (prev ? { ...prev, invoice: updated } : prev));
                  }}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] outline-none resize-none"
                />
              </Field>
              <Field label={t("form.terms")}>
                <textarea
                  value={inv.terms ?? ""}
                  onChange={async (e) => {
                    const updated = await updateInvoice(invoiceId, { terms: e.target.value });
                    if (updated) setState((prev) => (prev ? { ...prev, invoice: updated } : prev));
                  }}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] outline-none resize-none"
                />
              </Field>
            </div>

            <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4 space-y-2.5">
              <TotalRow label={t("totals.subtotal")} value={formatMoney(liveTotals.subtotal, cur)} />

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)] mb-1">{t("form.taxRate")}</div>
                  <input
                    type="number"
                    value={headerTax}
                    onChange={(e) => { setHeaderTax(Number(e.target.value)); setDirty(true); }}
                    className="w-full h-9 px-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] outline-none text-end"
                  />
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)] mb-1">{t("form.discountPct")}</div>
                  <input
                    type="number"
                    value={headerDisc}
                    onChange={(e) => { setHeaderDisc(Number(e.target.value)); setDirty(true); }}
                    className="w-full h-9 px-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] outline-none text-end"
                  />
                </div>
              </div>

              <TotalRow label={t("totals.discount")} value={`- ${formatMoney(liveTotals.discount_total, cur)}`} muted />
              <TotalRow label={t("totals.tax")} value={formatMoney(liveTotals.tax_total, cur)} muted />
              <div className="h-px bg-[var(--border-subtle)]" />
              <TotalRow label={t("totals.total")} value={formatMoney(liveTotals.total, cur)} big />
              <TotalRow label={t("totals.paid")} value={formatMoney(inv.amount_paid, cur)} muted />
              <TotalRow label={t("totals.balance")} value={formatMoney(liveTotals.balance, cur)} big accent="text-amber-400" />
            </div>
          </div>

          {/* Payments list */}
          <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
              <h3 className="text-[12px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {t("detail.payments")}
              </h3>
              <span className="text-[10px] font-semibold text-[var(--text-ghost)] bg-[var(--bg-surface)] px-1.5 py-0.5 rounded-full">
                {state.payments.length}
              </span>
            </div>
            {state.payments.length === 0 ? (
              <div className="px-4 py-6 text-[12px] text-[var(--text-dim)] text-center">
                {t("pay.noPayments")}
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)]">
                {state.payments.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-semibold text-[var(--text-primary)] truncate">
                        {formatMoney(p.amount, p.currency)}
                      </div>
                      <div className="text-[10px] text-[var(--text-dim)] truncate">
                        {p.received_at}
                        {p.method ? ` · ${p.method}` : ""}
                        {p.reference ? ` · ${p.reference}` : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <PaymentModal
        open={payOpen}
        invoice={inv}
        onClose={() => setPayOpen(false)}
        onRecorded={() => { setPayOpen(false); reload(); }}
      />
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{label}</div>
      <div className="text-[13px] font-semibold text-[var(--text-primary)] mt-0.5 truncate">{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{label}</div>
      {children}
    </div>
  );
}

function TotalRow({
  label,
  value,
  big,
  muted,
  accent,
}: {
  label: string;
  value: string;
  big?: boolean;
  muted?: boolean;
  accent?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-[11px] font-semibold uppercase tracking-wider ${muted ? "text-[var(--text-dim)]" : "text-[var(--text-muted)]"}`}>
        {label}
      </span>
      <span className={`${big ? "text-[16px]" : "text-[13px]"} font-bold ${accent ?? "text-[var(--text-primary)]"}`}>
        {value}
      </span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   LINE EDITOR ROW
   ══════════════════════════════════════════════════════════════════ */

function LineEditor({
  line,
  currency,
  onChange,
  onRemove,
}: {
  line: Partial<InvoiceItem>;
  currency: string;
  onChange: (patch: Partial<InvoiceItem>) => void;
  onRemove: () => void;
}) {
  const gross = Number(line.qty ?? 0) * Number(line.unit_price ?? 0);
  const disc = (gross * Number(line.line_discount_percent ?? 0)) / 100;
  const net = gross - disc;
  const tax = (net * Number(line.tax_rate ?? 0)) / 100;
  const total = net + tax;

  return (
    <div className="grid grid-cols-[1fr_40px] md:grid-cols-[1.6fr_70px_110px_70px_70px_110px_40px] gap-2 px-3 py-2 border-b last:border-b-0 border-[var(--border-subtle)] items-center">
      <input
        value={line.description ?? ""}
        onChange={(e) => onChange({ description: e.target.value })}
        placeholder="—"
        className="h-9 px-2 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] outline-none col-span-1 md:col-span-1"
      />
      <input
        type="number"
        value={line.qty ?? 0}
        onChange={(e) => onChange({ qty: Number(e.target.value) })}
        className="h-9 px-2 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] outline-none text-end hidden md:block"
      />
      <input
        type="number"
        value={line.unit_price ?? 0}
        onChange={(e) => onChange({ unit_price: Number(e.target.value) })}
        className="h-9 px-2 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] outline-none text-end hidden md:block"
      />
      <input
        type="number"
        value={line.tax_rate ?? 0}
        onChange={(e) => onChange({ tax_rate: Number(e.target.value) })}
        className="h-9 px-2 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] outline-none text-end hidden md:block"
      />
      <input
        type="number"
        value={line.line_discount_percent ?? 0}
        onChange={(e) => onChange({ line_discount_percent: Number(e.target.value) })}
        className="h-9 px-2 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] outline-none text-end hidden md:block"
      />
      <div className="text-[12px] font-semibold text-[var(--text-primary)] text-end hidden md:block">
        {formatMoney(total, currency)}
      </div>
      <button
        onClick={onRemove}
        className="h-9 w-9 rounded-md text-[var(--text-dim)] hover:text-rose-400 flex items-center justify-center"
      >
        <TrashIcon className="h-3.5 w-3.5" />
      </button>

      {/* Mobile: compact qty/price row under description */}
      <div className="md:hidden col-span-2 grid grid-cols-4 gap-1.5">
        <input type="number" value={line.qty ?? 0} onChange={(e) => onChange({ qty: Number(e.target.value) })} className="h-8 px-2 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] outline-none text-end" />
        <input type="number" value={line.unit_price ?? 0} onChange={(e) => onChange({ unit_price: Number(e.target.value) })} className="h-8 px-2 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] outline-none text-end" />
        <input type="number" value={line.tax_rate ?? 0} onChange={(e) => onChange({ tax_rate: Number(e.target.value) })} className="h-8 px-2 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] outline-none text-end" placeholder="Tax%" />
        <div className="h-8 flex items-center justify-end text-[11px] font-semibold text-[var(--text-primary)]">
          {formatMoney(total, currency)}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   INVOICE CREATE MODAL
   ══════════════════════════════════════════════════════════════════ */

function InvoiceFormModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { t } = useTranslation(invoicesT);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerLabel, setCustomerLabel] = useState<string>("");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setCustomerId(null);
    setCustomerLabel("");
    setIssueDate(new Date().toISOString().slice(0, 10));
    setDueDate("");
    setCurrency("USD");
    setPaymentTerms("");
    setNotes("");
  }, [open]);

  if (!open) return null;

  const save = async () => {
    const inv = await createInvoice({
      customer_id: customerId,
      issue_date: issueDate,
      due_date: dueDate || null,
      currency,
      payment_terms: paymentTerms || null,
      notes: notes || null,
    });
    if (inv) onCreated(inv.id);
  };

  return (
    <ScrollLockOverlay className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-2xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border-color)]">
          <h2 className="text-[15px] font-bold">{t("action.new")}</h2>
          <button onClick={onClose} className="h-7 w-7 rounded-md text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center">
            <CrossIcon size={14} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3 overflow-y-auto">
          <Field label={t("form.customer")}>
            <EntityPicker
              entityType="customer"
              entityId={customerId}
              entityLabel={customerLabel || null}
              onChange={(id, label) => { setCustomerId(id); setCustomerLabel(label ?? ""); }}
              placeholder={t("form.customer")}
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Field label={t("form.issueDate")}>
              <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] outline-none" />
            </Field>
            <Field label={t("form.dueDate")}>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] outline-none" />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Field label={t("form.currency")}>
              <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] outline-none uppercase" />
            </Field>
            <Field label={t("form.paymentTerms")}>
              <input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="Net 30" className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] outline-none" />
            </Field>
          </div>
          <Field label={t("form.notes")}>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] outline-none resize-none" />
          </Field>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border-color)]">
          <button onClick={onClose} className="h-9 px-3 text-[var(--text-dim)] hover:text-[var(--text-primary)] text-[12px] font-semibold">{t("btn.cancel")}</button>
          <button onClick={save} className="h-9 px-4 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold">
            {t("btn.create")}
          </button>
        </div>
      </div>
    </ScrollLockOverlay>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PAYMENT MODAL
   ══════════════════════════════════════════════════════════════════ */

function PaymentModal({
  open,
  invoice,
  onClose,
  onRecorded,
}: {
  open: boolean;
  invoice: InvoiceRow;
  onClose: () => void;
  onRecorded: () => void;
}) {
  const { t } = useTranslation(invoicesT);
  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState("bank_transfer");
  const [reference, setReference] = useState("");
  const [receivedAt, setReceivedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setAmount(Number(invoice.balance ?? 0).toFixed(2));
    setMethod("bank_transfer");
    setReference("");
    setReceivedAt(new Date().toISOString().slice(0, 10));
    setNotes("");
  }, [open, invoice]);

  if (!open) return null;

  const save = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return;
    await recordPayment(invoice.id, {
      amount: amt,
      method,
      reference: reference || null,
      received_at: receivedAt,
      notes: notes || null,
      currency: invoice.currency,
    });
    onRecorded();
  };

  return (
    <ScrollLockOverlay className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border-color)]">
          <h2 className="text-[15px] font-bold">{t("pay.title")}</h2>
          <button onClick={onClose} className="h-7 w-7 rounded-md text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center">
            <CrossIcon size={14} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <Field label={`${t("pay.amount")} (${invoice.currency})`}>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[14px] font-semibold outline-none text-end" />
          </Field>
          <Field label={t("pay.method")}>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] outline-none">
              <option value="bank_transfer">{t("pay.method.bank")}</option>
              <option value="cash">{t("pay.method.cash")}</option>
              <option value="card">{t("pay.method.card")}</option>
              <option value="cheque">{t("pay.method.cheque")}</option>
              <option value="other">{t("pay.method.other")}</option>
            </select>
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Field label={t("pay.reference")}>
              <input value={reference} onChange={(e) => setReference(e.target.value)} className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] outline-none" />
            </Field>
            <Field label={t("pay.date")}>
              <input type="date" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] outline-none" />
            </Field>
          </div>
          <Field label={t("form.notes")}>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] outline-none resize-none" />
          </Field>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border-color)]">
          <button onClick={onClose} className="h-9 px-3 text-[var(--text-dim)] hover:text-[var(--text-primary)] text-[12px] font-semibold">{t("btn.cancel")}</button>
          <button onClick={save} className="h-9 px-4 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold">
            {t("btn.recordPayment")}
          </button>
        </div>
      </div>
    </ScrollLockOverlay>
  );
}
