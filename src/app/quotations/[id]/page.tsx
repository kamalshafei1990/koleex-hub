"use client";

/* ---------------------------------------------------------------------------
   /quotations/[id] — quotation detail page.

   The "View quotation" link from the Request-Quote success modal lands here.
   It is the read-mostly view of a saved quotation:

     · Header with quote number, status, customer, dates, version
     · Line items (from doc.lines — the shape the catalog request writes)
     · Customer note + "Requested via catalog" badge when the draft was
       created via /products → Request Quote
     · Status transitions through PATCH /api/quotations/[id], guarded by the
       row version so a move made on a stale page is refused (409) instead
       of silently rewinding a save made in the builder
     · Delete with an audited reason
     · "Open in builder" — the editor is where prices and terms are set;
       this page is not allowed to be a dead end.

   Statuses are the five from src/lib/doc-status.ts, the same vocabulary the
   builder uses. The page used to know "cancelled" and "final" as well, and a
   status chosen here could not be read back by the editor.
   --------------------------------------------------------------------------- */

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import UserIcon from "@/components/icons/ui/UserIcon";
import CalendarRawIcon from "@/components/icons/ui/CalendarRawIcon";
import ExternalLinkIcon from "@/components/icons/ui/ExternalLinkIcon";
import RefreshCwIcon from "@/components/icons/ui/RefreshCwIcon";
import QuotationIcon from "@/components/icons/QuotationIcon";
import PermissionGate from "@/components/layout/PermissionGate";
import BrandLoading from "@/components/ui/BrandLoading";
import Button from "@/components/ui/Button";
import { BACK_CHROME } from "@/components/ui/PageHeader";
import { Button as KdsButton, ConfirmWithReason, EmptyState, StatusPill, useToast } from "@/components/kds";
import { useTranslation } from "@/lib/i18n";
import { quotationDetailT } from "@/lib/translations/quotation-detail";
import { useMeBootstrap } from "@/lib/me-bootstrap";
import { fmtDMY } from "@/lib/finance/format";
import { normaliseQuoteStatus, type QuoteStatusValue } from "@/lib/doc-status";

type Status = QuoteStatusValue;

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
  status: string;
  currency: string;
  discount_percent: number | null;
  total: number | null;
  issue_date: string | null;
  valid_till: string | null;
  notes: string | null;
  version?: number | null;
  updated_by_name?: string | null;
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

/* Tone per status for the KDS pill — the same reading as statusTone() in
   doc-status.ts, expressed in StatusPill's tone vocabulary. */
const STATUS_TONE: Record<Status, "neutral" | "brand" | "success" | "warning" | "error"> = {
  draft: "warning",
  sent: "brand",
  accepted: "success",
  rejected: "error",
  expired: "neutral",
};

/** Which transitions are legal from the current status. Keeps the
 *  action bar clean and avoids an inconsistent state flow. Accepted is
 *  terminal; a rejected or expired quote goes back to draft for rework. */
const ALLOWED_NEXT: Record<Status, Status[]> = {
  draft:    ["sent"],
  sent:     ["accepted", "rejected", "expired"],
  accepted: [],
  rejected: ["draft"],
  expired:  ["draft"],
};

/* Statuses a quotation can be deleted from. A sent or accepted document is
   a commitment to a customer and comes back through the status flow first. */
const DELETABLE: Status[] = ["draft", "rejected", "expired"];

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

/** Fill `{name}` slots in a translated string. */
function fill(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
}

/** Line total with the same formula the row uses: qty × price × (1 − disc%). */
function lineTotal(l: Line): number {
  const disc = l.line_discount_percent ?? 0;
  return l.qty * l.unit_price * (1 - disc / 100);
}

/* Errors are stored as FACTS and worded at render time, so the loader does
   not depend on `t` — otherwise a language switch would re-fetch the page. */
type PageError = { text: string } | { status: number } | { network: true };

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
  const { t } = useTranslation(quotationDetailT);
  const { showToast, toastElement } = useToast();
  const { data: boot } = useMeBootstrap();

  const [q, setQ] = useState<QuotationRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<PageError | null>(null);
  /* A 409 from PATCH: someone else saved since this page loaded. Shown as
     its own banner with a Reload action rather than a plain error, because
     the fix is specific and one click away. */
  const [conflict, setConflict] = useState<{ message: string; by: string | null } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setConflict(null);
    try {
      const res = await fetch(`/api/quotations/${encodeURIComponent(id)}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (res.status === 404) { setNotFound(true); return; }
      if (!res.ok) {
        /* Pull the server-supplied message so the user sees WHY the
           load failed instead of staring at a spinner. */
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ? { text: body.error } : { status: res.status });
        return;
      }
      const json = (await res.json()) as { quotation: QuotationRow };
      setQ(json.quotation);
    } catch (e) {
      setError(e instanceof Error && e.message ? { text: e.message } : { network: true });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const statusLabel = (s: Status) => t(`qd.status.${s}`, s);
  const errorText = (e: PageError | null): string | null => {
    if (!e) return null;
    if ("text" in e) return e.text;
    if ("status" in e) return fill(t("qd.loadFailedStatus"), { status: e.status });
    return t("qd.networkError");
  };

  async function changeStatus(next: Status) {
    if (!q) return;
    setWorking(true);
    setError(null);
    setConflict(null);
    try {
      const res = await fetch(`/api/quotations/${encodeURIComponent(q.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: next,
          /* The version this page loaded. A mismatch on the server means the
             builder (or another tab) saved in between — see the 409 branch. */
          base_version: typeof q.version === "number" ? q.version : undefined,
        }),
      });
      if (res.status === 409) {
        const json = (await res.json().catch(() => ({}))) as {
          error?: string;
          current?: { updated_by_name?: string | null };
        };
        setConflict({
          message: json.error || t("qd.conflict"),
          by: json.current?.updated_by_name ?? null,
        });
        return;
      }
      if (res.status === 403) {
        showToast(t("qd.forbidden"), "error");
        return;
      }
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        setError({ text: json.error || fill(t("qd.actionFailed"), { status: res.status }) });
        return;
      }
      const json = (await res.json()) as { quotation: QuotationRow };
      setQ(json.quotation);
      showToast(fill(t("qd.statusUpdated"), { status: statusLabel(next) }), "success");
    } catch (e) {
      setError(e instanceof Error && e.message ? { text: e.message } : { network: true });
    } finally {
      setWorking(false);
    }
  }

  async function handleDelete(reason: string) {
    if (!q) return;
    setWorking(true);
    try {
      const res = await fetch(`/api/quotations/${encodeURIComponent(q.id)}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason || null }),
      });
      if (res.status === 403) {
        showToast(t("qd.deleteForbidden"), "error");
        return;
      }
      if (!res.ok) {
        showToast(fill(t("qd.deleteFailed"), { status: res.status }), "error");
        return;
      }
      showToast(t("qd.deleted"), "success");
      router.push("/quotations");
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("qd.networkError"), "error");
    } finally {
      setWorking(false);
    }
  }

  const backAction = (
    <KdsButton variant="secondary" onClick={() => router.push("/quotations")}>
      {t("qd.back")}
    </KdsButton>
  );

  if (notFound) {
    return (
      <div className="min-h-full bg-[var(--bg-primary)]">
        <div className="mx-auto max-w-[720px] px-4 py-10 md:px-6">
          <EmptyState
            icon={<QuotationIcon size={28} />}
            title={t("qd.notFound")}
            hint={t("qd.notFoundHint")}
            action={backAction}
          />
        </div>
      </div>
    );
  }

  if (loading) {
    return <BrandLoading />;
  }

  /* If the fetch failed (e.g. server error, bad schema, network), show
     the actual error + a retry button instead of an endless spinner —
     users were getting stuck on "still loading" with no signal that
     anything was wrong. */
  if (!q) {
    return (
      <div className="min-h-full bg-[var(--bg-primary)]">
        <div className="mx-auto max-w-[720px] px-4 py-10 md:px-6">
          <EmptyState
            icon={<QuotationIcon size={28} />}
            title={t("qd.loadFailed")}
            hint={errorText(error) || t("qd.unknownError")}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <KdsButton onClick={() => void load()}>{t("qd.retry")}</KdsButton>
                {backAction}
              </div>
            }
          />
        </div>
      </div>
    );
  }

  const lines = q.doc?.lines ?? [];
  const customerName =
    q.customer?.company_name || q.customer?.name || null;
  const isCustomerRequest = q.doc?.source === "customer-request";
  /* Row total when the builder has computed one; otherwise the same
     per-line formula as the table, so the header can never disagree with
     the rows beneath it. */
  const total = q.total ?? lines.reduce((sum, l) => sum + lineTotal(l), 0);
  /* Anything outside the five known values (a legacy row) is shown as
     draft: that is where the flow starts, and every move from it is legal. */
  const status: Status = normaliseQuoteStatus(q.status) ?? "draft";
  const next = ALLOWED_NEXT[status];
  const builderHref = `/quotations?doc=${encodeURIComponent(q.id)}`;

  /* The bootstrap carries no per-action flags, so the button stays and a
     403 is answered with a clear message. Hidden while viewing-as: the
     server refuses every write in that mode anyway. */
  const viewingAs = !!boot?.auth?.viewing_as;
  const canDelete = DELETABLE.includes(status) && !viewingAs;

  const panelCls =
    "bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5 md:p-6";

  return (
    <div className="min-h-full bg-[var(--bg-primary)]">
      <div className="mx-auto px-4 md:px-6 lg:px-10 xl:px-16 py-6 md:py-8 max-w-[1200px]">

        {/* ── Header ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/quotations" aria-label={t("qd.back")} className={BACK_CHROME}>
              <ArrowLeftIcon size={14} />
              <span className="hidden text-[12px] font-medium sm:inline">{t("qd.backShort")}</span>
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg md:text-xl font-semibold text-[var(--text-primary)] truncate">
                {q.quote_no}
              </h1>
              <p className="text-xs text-[var(--text-dim)]">{t("qd.title")}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              icon={<ExternalLinkIcon size={13} />}
              onClick={() => router.push(builderHref)}
            >
              {t("qd.openInBuilder")}
            </Button>
            {canDelete && (
              <Button
                variant="danger"
                icon={<TrashIcon size={13} />}
                disabled={working}
                onClick={() => setConfirmDelete(true)}
              >
                {t("qd.delete")}
              </Button>
            )}
          </div>
        </div>

        {/* Version conflict — the one error with a specific fix. */}
        {conflict && (
          <div
            className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3.5 text-sm text-amber-300"
            role="alert"
          >
            <div className="min-w-0">
              <p>{conflict.message}</p>
              {conflict.by && (
                <p className="mt-0.5 text-[12px] text-amber-300/80">
                  {fill(t("qd.conflictBy"), { name: conflict.by })}
                </p>
              )}
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCwIcon size={12} />}
              onClick={() => void load()}
            >
              {t("qd.reload")}
            </Button>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400" role="alert">
            {errorText(error)}
          </div>
        )}

        {/* ── Meta / Actions row ── */}
        <section className={`${panelCls} mb-4`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1 min-w-[240px]">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <StatusPill tone={STATUS_TONE[status]} className="uppercase">
                  {statusLabel(status)}
                </StatusPill>
                {isCustomerRequest && (
                  <StatusPill tone="brand" className="uppercase">
                    {t("qd.viaCatalog")}
                  </StatusPill>
                )}
                {typeof q.version === "number" && (
                  <span className="text-[11px] text-[var(--text-dim)] tabular-nums">
                    {fill(t("qd.version"), { n: q.version })}
                  </span>
                )}
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
                <div className="flex items-center gap-2">
                  <UserIcon size={12} className="text-[var(--text-faint)]" />
                  <dt className="text-[var(--text-dim)]">{t("qd.customer")}</dt>
                  <dd className="text-[var(--text-primary)]">
                    {customerName ? (
                      customerName
                    ) : (
                      <span className="text-[var(--text-faint)] italic">{t("qd.notLinked")}</span>
                    )}
                  </dd>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarRawIcon size={12} className="text-[var(--text-faint)]" />
                  <dt className="text-[var(--text-dim)]">{t("qd.issued")}</dt>
                  <dd className="text-[var(--text-primary)] tabular-nums">{fmtDMY(q.issue_date)}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarRawIcon size={12} className="text-[var(--text-faint)]" />
                  <dt className="text-[var(--text-dim)]">{t("qd.validTill")}</dt>
                  <dd className="text-[var(--text-primary)] tabular-nums">{fmtDMY(q.valid_till)}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <DocumentIcon size={12} className="text-[var(--text-faint)]" />
                  <dt className="text-[var(--text-dim)]">{t("qd.currency")}</dt>
                  <dd className="text-[var(--text-primary)]">{q.currency}</dd>
                </div>
              </dl>
            </div>

            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t("qd.total")}</p>
              <p className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] tabular-nums">
                {fmtMoney(total, q.currency)}
              </p>
            </div>
          </div>

          {/* Status transition actions */}
          {next.length > 0 && !viewingAs && (
            <div className="mt-5 pt-4 border-t border-[var(--border-faint)] flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-[var(--text-dim)] mr-1">{t("qd.moveTo")}</span>
              {next.map((s) => (
                <Button
                  key={s}
                  variant="secondary"
                  size="sm"
                  disabled={working}
                  onClick={() => void changeStatus(s)}
                >
                  <StatusPill tone={STATUS_TONE[s]} className="h-[18px] px-1.5 text-[10px] uppercase">
                    {statusLabel(s)}
                  </StatusPill>
                </Button>
              ))}
            </div>
          )}
        </section>

        {/* ── Customer note ── */}
        {q.doc?.customerNote && (
          <section className={`${panelCls} mb-4`}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)] mb-2">
              {t("qd.customerMessage")}
            </p>
            <p className="text-[13px] text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
              {q.doc.customerNote}
            </p>
          </section>
        )}

        {/* ── Line items ── */}
        <section className={panelCls}>
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--border-faint)]">
            <h2 className="text-[14px] font-bold text-[var(--text-primary)]">{t("qd.lineItems")}</h2>
            <span className="text-[11px] text-[var(--text-dim)]">
              {lines.length === 1 ? t("qd.itemCountOne") : fill(t("qd.itemCount"), { n: lines.length })}
            </span>
          </div>

          {lines.length === 0 ? (
            <p className="text-[13px] text-[var(--text-dim)] py-3">{t("qd.noLines")}</p>
          ) : (
            <div className="overflow-x-auto -mx-2 md:mx-0">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)] border-b border-[var(--border-faint)]">
                    <th className="text-left py-2 px-2">{t("qd.col.product")}</th>
                    <th className="text-right py-2 px-2 w-[80px]">{t("qd.col.qty")}</th>
                    <th className="text-right py-2 px-2 w-[110px]">{t("qd.col.unitPrice")}</th>
                    <th className="text-right py-2 px-2 w-[90px]">{t("qd.col.discount")}</th>
                    <th className="text-right py-2 px-2 w-[120px]">{t("qd.col.lineTotal")}</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    const disc = l.line_discount_percent ?? 0;
                    return (
                      <tr key={`${l.product_id ?? "line"}-${i}`} className="border-b border-[var(--border-faint)] last:border-0">
                        <td className="py-2.5 px-2">
                          {l.product_slug ? (
                            <Link
                              href={`/products/${l.product_slug}`}
                              className="text-[var(--text-primary)] hover:underline underline-offset-2"
                            >
                              {l.product_name || t("qd.unnamedProduct")}
                            </Link>
                          ) : (
                            <span className="text-[var(--text-primary)]">
                              {l.product_name || t("qd.unnamedProduct")}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-right tabular-nums">{l.qty}</td>
                        <td className="py-2.5 px-2 text-right tabular-nums">
                          {l.unit_price > 0 ? fmtMoney(l.unit_price, q.currency) : <span className="text-[var(--text-faint)] italic">{t("qd.tbd")}</span>}
                        </td>
                        <td className="py-2.5 px-2 text-right tabular-nums">
                          {disc > 0 ? `${disc}%` : "—"}
                        </td>
                        <td className="py-2.5 px-2 text-right tabular-nums font-medium">
                          {l.unit_price > 0 ? fmtMoney(lineTotal(l), q.currency) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {lines.some((l) => l.unit_price === 0) && (
                <p className="mt-3 text-[11px] text-amber-400">
                  {t("qd.tbdHint")}
                </p>
              )}
            </div>
          )}
        </section>

        {/* ── Notes (internal) ── */}
        {q.notes && (
          <section className={`${panelCls} mt-4`}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)] mb-2">
              {t("qd.internalNotes")}
            </p>
            <p className="text-[13px] text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
              {q.notes}
            </p>
          </section>
        )}
      </div>

      {/* ── Delete confirm — audited as critical, so it asks for a reason ── */}
      <ConfirmWithReason
        open={confirmDelete}
        title={fill(t("qd.deleteTitle"), { no: q.quote_no })}
        reasonPlaceholder={t("qd.deleteReason")}
        confirmLabel={t("qd.deleteConfirm")}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={(reason) => { setConfirmDelete(false); void handleDelete(reason); }}
      />
      {toastElement}
    </div>
  );
}
