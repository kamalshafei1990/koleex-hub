"use client";

/* ---------------------------------------------------------------------------
   /quotations/[id] — quotation detail page.

   Until now this route fell through to the global "UNDER DEVELOPMENT"
   placeholder, so the "View quotation" link from the Request-Quote
   success modal dead-ended. This page fills that gap:

     · Header with quote number, status, customer, dates
     · Line items (from doc.lines — the canonical source for this app)
     · Customer note + "Requested via catalog" badge when the draft
       was created via /products → Request Quote
     · Status transitions (draft → sent → accepted / rejected /
       final), with a delete option on draft / cancelled.

   Guarded by the existing /api/quotations/[id] endpoints which
   already enforce tenant scoping + Quotations module access. No
   new permissions needed.
   --------------------------------------------------------------------------- */

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import UserIcon from "@/components/icons/ui/UserIcon";
import CalendarRawIcon from "@/components/icons/ui/CalendarRawIcon";
import QuotationIcon from "@/components/icons/QuotationIcon";
import PermissionGate from "@/components/layout/PermissionGate";

type Status =
  | "draft"
  | "sent"
  | "accepted"
  | "rejected"
  | "expired"
  | "cancelled"
  | "final";

interface Line {
  product_id: string;
  product_name?: string;
  product_slug?: string | null;
  model_id?: string | null;
  qty: number;
  unit_price: number;
  line_discount_percent?: number;
}

interface QuotationRow {
  id: string;
  quote_no: string;
  customer_id: string | null;
  status: Status;
  currency: string;
  discount_percent: number | null;
  total: number | null;
  issue_date: string | null;
  valid_till: string | null;
  notes: string | null;
  doc: {
    lines?: Line[];
    customerNote?: string | null;
    source?: string | null;
    requestedBy?: { account_id?: string; user_type?: string; requested_at?: string };
  } | null;
  created_at: string;
  customer?: {
    id: string;
    name?: string | null;
    company_name?: string | null;
  } | null;
}

const STATUS_STYLES: Record<Status, string> = {
  draft:     "text-amber-400 bg-amber-400/10 border-amber-400/20",
  sent:      "text-blue-400 bg-blue-400/10 border-blue-400/20",
  accepted:  "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  final:     "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  rejected:  "text-red-400 bg-red-400/10 border-red-400/20",
  expired:   "text-slate-400 bg-slate-400/10 border-slate-400/20",
  cancelled: "text-slate-400 bg-slate-400/10 border-slate-400/20",
};

const STATUS_LABELS: Record<Status, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  rejected: "Rejected",
  expired: "Expired",
  cancelled: "Cancelled",
  final: "Final",
};

/** Which transitions are legal from the current status. Keeps the
 *  action bar clean and avoids an inconsistent state flow. */
const ALLOWED_NEXT: Record<Status, Status[]> = {
  draft:     ["sent", "cancelled"],
  sent:      ["accepted", "rejected", "expired"],
  accepted:  ["final"],
  final:     [],
  rejected:  ["draft"],
  expired:   ["draft"],
  cancelled: ["draft"],
};

function fmtMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency || ""} ${amount.toFixed(2)}`;
  }
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function QuotationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <PermissionGate module="Quotations">
      <QuotationDetail params={params} />
    </PermissionGate>
  );
}

function QuotationDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [q, setQ] = useState<QuotationRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/quotations/${encodeURIComponent(id)}`, {
        credentials: "include",
      });
      if (res.status === 404) { setNotFound(true); return; }
      if (!res.ok) {
        /* Pull the server-supplied message so the user sees WHY the
           load failed instead of staring at a spinner. */
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error || `Failed to load quotation (${res.status})`);
        return;
      }
      const json = (await res.json()) as { quotation: QuotationRow };
      setQ(json.quotation);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function changeStatus(next: Status) {
    if (!q) return;
    setWorking(true);
    setError(null);
    try {
      const res = await fetch("/api/quotations", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: q.id,
          quote_no: q.quote_no,
          customer_id: q.customer_id,
          currency: q.currency,
          status: next,
          issue_date: q.issue_date,
          valid_till: q.valid_till,
          total: q.total,
          doc: q.doc ?? {},
        }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        setError(json.error || `Failed (${res.status})`);
        return;
      }
      await load();
    } finally {
      setWorking(false);
    }
  }

  async function handleDelete() {
    if (!q) return;
    setWorking(true);
    const res = await fetch(`/api/quotations/${encodeURIComponent(q.id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    setWorking(false);
    if (!res.ok) {
      setError(`Delete failed (${res.status})`);
      return;
    }
    router.push("/quotations");
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <QuotationIcon size={32} className="mx-auto text-[var(--text-faint)] mb-3" />
          <p className="text-sm text-[var(--text-primary)] font-medium mb-1">Quotation not found</p>
          <Link href="/quotations" className="text-xs text-[var(--text-dim)] hover:text-[var(--text-primary)] underline underline-offset-2">
            Back to quotations
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <SpinnerIcon size={28} className="animate-spin text-[var(--text-dim)]" />
      </div>
    );
  }

  /* If the fetch failed (e.g. server error, bad schema, network), show
     the actual error + a retry button instead of an endless spinner —
     users were getting stuck on "still loading" with no signal that
     anything was wrong. */
  if (!q) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <QuotationIcon size={32} className="mx-auto text-[var(--text-faint)] mb-3" />
          <p className="text-sm text-[var(--text-primary)] font-medium mb-1">
            Couldn&apos;t load this quotation
          </p>
          <p className="text-xs text-[var(--text-dim)] mb-4">
            {error || "Unknown error."}
          </p>
          <div className="flex gap-2 justify-center">
            <button
              type="button"
              onClick={() => void load()}
              className="h-8 px-3 rounded-lg text-[12px] font-medium border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] transition-colors"
            >
              Retry
            </button>
            <Link
              href="/quotations"
              className="h-8 px-3 rounded-lg text-[12px] font-medium border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors inline-flex items-center"
            >
              Back to list
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const lines = q.doc?.lines ?? [];
  const customerName =
    q.customer?.company_name || q.customer?.name || null;
  const isCustomerRequest = q.doc?.source === "customer-request";
  const total = q.total ?? lines.reduce((sum, l) => sum + (l.qty * l.unit_price), 0);
  const status = q.status;
  const statusStyle = STATUS_STYLES[status] || STATUS_STYLES.draft;
  const statusLabel = STATUS_LABELS[status] || status;
  const next = ALLOWED_NEXT[status] || [];

  const canDelete = ["draft", "cancelled", "rejected", "expired"].includes(status);

  const panelCls =
    "bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5 md:p-6";

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="mx-auto px-4 md:px-6 lg:px-10 xl:px-16 py-6 md:py-8 max-w-[1200px]">

        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/quotations"
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0"
              aria-label="Back to quotations"
            >
              <ArrowLeftIcon size={16} />
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg md:text-xl font-semibold text-[var(--text-primary)] truncate">
                {q.quote_no}
              </h1>
              <p className="text-xs text-[var(--text-dim)]">Quotation</p>
            </div>
          </div>
          {canDelete && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={working}
              className="h-9 px-3 rounded-xl text-[12px] font-medium border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <TrashIcon size={14} /> Delete
            </button>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400" role="alert">
            {error}
          </div>
        )}

        {/* ── Meta / Actions row ── */}
        <section className={`${panelCls} mb-4`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1 min-w-[240px]">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border uppercase ${statusStyle}`}>
                  {statusLabel}
                </span>
                {isCustomerRequest && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md border bg-blue-500/10 border-blue-400/20 text-blue-400 uppercase">
                    Requested via catalog
                  </span>
                )}
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
                <div className="flex items-center gap-2">
                  <UserIcon size={12} className="text-[var(--text-faint)]" />
                  <dt className="text-[var(--text-dim)]">Customer</dt>
                  <dd className="text-[var(--text-primary)]">
                    {customerName ? (
                      customerName
                    ) : (
                      <span className="text-[var(--text-faint)] italic">Not linked</span>
                    )}
                  </dd>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarRawIcon size={12} className="text-[var(--text-faint)]" />
                  <dt className="text-[var(--text-dim)]">Issued</dt>
                  <dd className="text-[var(--text-primary)]">{fmtDate(q.issue_date)}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarRawIcon size={12} className="text-[var(--text-faint)]" />
                  <dt className="text-[var(--text-dim)]">Valid till</dt>
                  <dd className="text-[var(--text-primary)]">{fmtDate(q.valid_till)}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <DocumentIcon size={12} className="text-[var(--text-faint)]" />
                  <dt className="text-[var(--text-dim)]">Currency</dt>
                  <dd className="text-[var(--text-primary)]">{q.currency}</dd>
                </div>
              </dl>
            </div>

            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">Total</p>
              <p className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] tabular-nums">
                {fmtMoney(total, q.currency)}
              </p>
            </div>
          </div>

          {/* Status transition actions */}
          {next.length > 0 && (
            <div className="mt-5 pt-4 border-t border-[var(--border-faint)] flex flex-wrap gap-2">
              <span className="text-[11px] text-[var(--text-dim)] self-center mr-1">Move to:</span>
              {next.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => changeStatus(s)}
                  disabled={working}
                  className={`h-8 px-3 rounded-lg text-[12px] font-medium border transition-colors ${STATUS_STYLES[s]} hover:brightness-110 disabled:opacity-50`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ── Customer note ── */}
        {q.doc?.customerNote && (
          <section className={`${panelCls} mb-4`}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)] mb-2">
              Customer message
            </p>
            <p className="text-[13px] text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
              {q.doc.customerNote}
            </p>
          </section>
        )}

        {/* ── Line items ── */}
        <section className={panelCls}>
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--border-faint)]">
            <h2 className="text-[14px] font-bold text-[var(--text-primary)]">Line items</h2>
            <span className="text-[11px] text-[var(--text-dim)]">{lines.length} {lines.length === 1 ? "item" : "items"}</span>
          </div>

          {lines.length === 0 ? (
            <p className="text-[13px] text-[var(--text-dim)] py-3">No line items.</p>
          ) : (
            <div className="overflow-x-auto -mx-2 md:mx-0">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)] border-b border-[var(--border-faint)]">
                    <th className="text-left py-2 px-2">Product</th>
                    <th className="text-right py-2 px-2 w-[80px]">Qty</th>
                    <th className="text-right py-2 px-2 w-[110px]">Unit price</th>
                    <th className="text-right py-2 px-2 w-[90px]">Discount</th>
                    <th className="text-right py-2 px-2 w-[120px]">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    const disc = l.line_discount_percent ?? 0;
                    const lineTotal = l.qty * l.unit_price * (1 - disc / 100);
                    return (
                      <tr key={i} className="border-b border-[var(--border-faint)] last:border-0">
                        <td className="py-2.5 px-2">
                          {l.product_slug ? (
                            <Link
                              href={`/products/${l.product_slug}`}
                              className="text-[var(--text-primary)] hover:underline underline-offset-2"
                            >
                              {l.product_name || "(Unnamed product)"}
                            </Link>
                          ) : (
                            <span className="text-[var(--text-primary)]">
                              {l.product_name || "(Unnamed product)"}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-right tabular-nums">{l.qty}</td>
                        <td className="py-2.5 px-2 text-right tabular-nums">
                          {l.unit_price > 0 ? fmtMoney(l.unit_price, q.currency) : <span className="text-[var(--text-faint)] italic">TBD</span>}
                        </td>
                        <td className="py-2.5 px-2 text-right tabular-nums">
                          {disc > 0 ? `${disc}%` : "—"}
                        </td>
                        <td className="py-2.5 px-2 text-right tabular-nums font-medium">
                          {l.unit_price > 0 ? fmtMoney(lineTotal, q.currency) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {lines.some((l) => l.unit_price === 0) && (
                <p className="mt-3 text-[11px] text-amber-400">
                  Some lines still have TBD pricing. Set unit prices in the Quotations builder
                  before sending to the customer.
                </p>
              )}
            </div>
          )}
        </section>

        {/* ── Notes (internal) ── */}
        {q.notes && (
          <section className={`${panelCls} mt-4`}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)] mb-2">
              Internal notes
            </p>
            <p className="text-[13px] text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
              {q.notes}
            </p>
          </section>
        )}
      </div>

      {/* ── Delete confirm ── */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => !working && setConfirmDelete(false)}
        >
          <div
            className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-2xl p-5 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-[14px] font-semibold text-[var(--text-primary)] mb-1">Delete {q.quote_no}?</h2>
            <p className="text-[12px] text-[var(--text-dim)] mb-4">
              This removes the quotation and its line items. Cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={working}
                className="h-9 px-4 rounded-lg text-[12px] font-medium border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={working}
                className="h-9 px-4 rounded-lg text-[12px] font-medium bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {working ? <SpinnerIcon size={12} className="animate-spin" /> : <TrashIcon size={12} />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
