"use client";

/* ---------------------------------------------------------------------------
   SupplierDetail — the Supplier 360 page (/suppliers/[id]).

   One place to understand a supplier: identity + commercial terms up top,
   then tabbed sections for Purchase Orders, Bills & Payments, Products
   supplied, and Certifications/Quality. Data comes from
   GET /api/suppliers/[id] (tenant-scoped, fault-tolerant). Pure
   presentation here — monochrome Koleex grammar, custom SVG icons,
   desktop + mobile parity.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { humanizeError } from "@/lib/ui/humanize-error";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import StarIcon from "@/components/icons/ui/StarIcon";
import Building2Icon from "@/components/icons/ui/Building2Icon";
import GlobeIcon from "@/components/icons/ui/GlobeIcon";
import MapPinIcon from "@/components/icons/ui/MapPinIcon";
import PhoneIcon from "@/components/icons/ui/PhoneIcon";
import EnvelopeIcon from "@/components/icons/ui/EnvelopeIcon";
import PackageIcon from "@/components/icons/ui/PackageIcon";
import ReceiptIcon from "@/components/icons/ui/ReceiptIcon";
import WalletIcon from "@/components/icons/ui/WalletIcon";
import FileCheckIcon from "@/components/icons/ui/FileCheckIcon";
import ShipIcon from "@/components/icons/ui/ShipIcon";
import {
  STRATEGIC_STATUS_LABELS,
  strategicStatusTone,
  classificationLabel,
  CLASSIFICATION_LABELS,
  type StrategicStatus,
} from "@/lib/suppliers/intelligence";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import Edit3Icon from "@/components/icons/ui/Edit3Icon";

type Row = Record<string, unknown>;
interface Payload {
  supplier: Row;
  purchaseOrders: Row[];
  bills: Row[];
  payments: Row[];
  products: Row[];
  receipts: Row[];
  returns: Row[];
  classifications: Row[];
  contactPersons: Row[];
  media: Row[];
  statusHistory: Row[];
  readiness: { score: number; dimensions: { key: string; label: string; weight: number; met: number; total: number; fraction: number }[] };
}

/* ── defensive getters (the API returns raw rows of unknown shape) ── */
const str = (r: Row, ...keys: string[]): string => {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return "";
};
const num = (r: Row, ...keys: string[]): number => {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  }
  return 0;
};
const money = (n: number, c?: string): string => {
  const code = (c && c.trim()) || "USD";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
    }).format(n || 0);
  } catch {
    return `${code} ${Math.round(n || 0).toLocaleString()}`;
  }
};
const fmtDate = (s: string): string => {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};
const initials = (label: string): string => {
  const p = label.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[1][0]).toUpperCase();
};

/* status → tone class (monochrome with a restrained accent) */
function statusTone(s: string): string {
  const v = s.toLowerCase();
  if (/(paid|complete|received|approved|active|closed)/.test(v))
    return "bg-[var(--bg-surface-subtle)] text-[var(--text-primary)]";
  if (/(overdue|reject|cancel|void)/.test(v))
    return "bg-rose-500/10 text-rose-300";
  if (/(pending|draft|open|partial|sent|await)/.test(v))
    return "bg-amber-500/10 text-amber-300";
  return "bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)]";
}

const SectionHead = ({ eyebrow, title }: { eyebrow?: string; title: string }) => (
  <div className="space-y-1">
    {eyebrow ? (
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{eyebrow}</div>
    ) : null}
    <h3 className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">{title}</h3>
  </div>
);

const StatusPill = ({ value }: { value: string }) =>
  value ? (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize ${statusTone(value)}`}>
      {value.replace(/_/g, " ")}
    </span>
  ) : (
    <span className="text-[var(--text-faint)]">—</span>
  );

type Tab = "overview" | "orders" | "bills" | "products" | "quality";

export default function SupplierDetail({ id }: { id: string }) {
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const r = await fetch(`/api/suppliers/${id}`, { credentials: "include" });
        const j = await r.json();
        if (!r.ok) throw new Error(humanizeError(j.error ?? `HTTP ${r.status}`));
        setData(j as Payload);
      } catch (e) {
        if (!opts?.silent) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    void load();
  }, [load]);

  /* ── inline edit state (Phase 2 operational layer) ── */
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusDraft, setStatusDraft] = useState("");
  const [statusReason, setStatusReason] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [classOpen, setClassOpen] = useState(false);
  const [busyClass, setBusyClass] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const patchSupplier = useCallback(
    async (body: Record<string, unknown>) => {
      setEditError(null);
      const r = await fetch(`/api/suppliers/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(humanizeError(j.error ?? `HTTP ${r.status}`));
      }
    },
    [id],
  );

  const saveStatus = useCallback(async () => {
    setSavingStatus(true);
    try {
      await patchSupplier({
        strategic_status: statusDraft || null,
        strategic_status_reason: statusReason || null,
      });
      setStatusOpen(false);
      setStatusReason("");
      await load({ silent: true });
    } catch (e) {
      setEditError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingStatus(false);
    }
  }, [patchSupplier, statusDraft, statusReason, load]);

  const mutateClassification = useCallback(
    async (classification: string, action: "add" | "remove") => {
      setBusyClass(classification);
      setEditError(null);
      try {
        const r = await fetch(
          `/api/suppliers/${id}/classifications${action === "remove" ? `?classification=${encodeURIComponent(classification)}` : ""}`,
          {
            method: action === "remove" ? "DELETE" : "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: action === "add" ? JSON.stringify({ classification }) : undefined,
          },
        );
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(humanizeError(j.error ?? `HTTP ${r.status}`));
        }
        await load({ silent: true });
      } catch (e) {
        setEditError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusyClass(null);
      }
    },
    [id, load],
  );

  const s = data?.supplier ?? {};
  const name = str(s, "company_name_en", "company_name", "display_name", "full_name") || "Supplier";
  const isActive = (s.is_active ?? true) !== false;
  const rating = num(s, "rating");
  const certs = Array.isArray(s.certifications) ? (s.certifications as unknown[]).map(String) : [];
  const currency = str(s, "currency") || "USD";

  const stats = useMemo(() => {
    const pos = data?.purchaseOrders ?? [];
    const bills = data?.bills ?? [];
    const totalPurchases =
      bills.reduce((n, b) => n + num(b, "total", "total_amount", "grand_total"), 0) ||
      pos.reduce((n, p) => n + num(p, "total", "total_amount", "grand_total"), 0);
    const outstanding = bills.reduce((n, b) => {
      const bal = num(b, "balance");
      return n + (bal || num(b, "total", "total_amount") - num(b, "amount_paid", "paid_amount"));
    }, 0);
    const openPos = pos.filter((p) => !/(complete|closed|cancel|void)/i.test(str(p, "status"))).length;
    return {
      totalPurchases,
      outstanding: Math.max(0, outstanding),
      openPos,
      products: (data?.products ?? []).length,
    };
  }, [data]);

  /* ── Performance scorecard ──
     On-time % (receipt date vs PO promised date), average lead time
     (receipt vs order date), and return/defect rate. Computed from the
     fault-tolerant receipts/returns datasets; any metric without a basis
     shows "—". */
  const scorecard = useMemo(() => {
    const pos = data?.purchaseOrders ?? [];
    const receipts = data?.receipts ?? [];
    const rets = data?.returns ?? [];
    const poById = new Map<string, Row>();
    for (const p of pos) {
      const pid = str(p, "id");
      if (pid) poById.set(pid, p);
    }
    const dayDiff = (later: string, earlier: string): number | null => {
      const a = new Date(later).getTime();
      const b = new Date(earlier).getTime();
      if (Number.isNaN(a) || Number.isNaN(b)) return null;
      return Math.round((a - b) / 86_400_000);
    };
    let onTime = 0;
    let withPromise = 0;
    const leads: number[] = [];
    for (const r of receipts) {
      const rec = str(r, "received_at", "receipt_date", "created_at");
      const po = poById.get(str(r, "po_id"));
      if (!rec || !po) continue;
      const promised = str(po, "delivery_date", "eta", "expected_date");
      if (promised) {
        withPromise++;
        const slack = dayDiff(promised, rec);
        if (slack !== null && slack >= 0) onTime++;
      }
      const ordered = str(po, "order_date", "created_at");
      if (ordered) {
        const l = dayDiff(rec, ordered);
        if (l !== null && l >= 0) leads.push(l);
      }
    }
    const basis = receipts.length || pos.length;
    const defects = rets.filter((r) =>
      /(defect|quality|damage|faulty|broken|wrong)/i.test(str(r, "reason_code", "reason", "reason_notes")),
    ).length;
    return {
      onTimePct: withPromise ? Math.round((onTime / withPromise) * 100) : null,
      avgLeadDays: leads.length ? Math.round(leads.reduce((a, b) => a + b, 0) / leads.length) : null,
      returns: rets.length,
      returnRate: basis ? Math.round((rets.length / basis) * 100) : null,
      defects,
      hasHistory: basis > 0 || rets.length > 0,
    };
  }, [data]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 md:px-8 py-10">
        <div className="h-8 w-40 animate-pulse rounded bg-[var(--bg-surface-subtle)]" />
        <div className="mt-8 h-44 animate-pulse rounded-2xl bg-[var(--bg-surface-subtle)]" />
        <div className="mt-4 h-64 animate-pulse rounded-2xl bg-[var(--bg-surface-subtle)]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 md:px-8 py-16 text-center">
        <p className="text-sm text-[var(--text-secondary)]">{error ?? "Supplier not found."}</p>
        <button
          onClick={() => router.push("/suppliers")}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--bg-inverted)] px-4 py-2 text-[12px] font-semibold text-[var(--text-inverted)] hover:opacity-90"
        >
          <ArrowLeftIcon className="h-4 w-4" /> Back to suppliers
        </button>
      </div>
    );
  }

  const terms: { label: string; value: string; icon: React.ReactNode }[] = [
    { label: "Payment terms", value: str(s, "payment_terms"), icon: <WalletIcon className="h-4 w-4" /> },
    { label: "Currency", value: str(s, "currency"), icon: <ReceiptIcon className="h-4 w-4" /> },
    { label: "MOQ", value: str(s, "moq"), icon: <PackageIcon className="h-4 w-4" /> },
    { label: "Lead time", value: str(s, "lead_time"), icon: <ShipIcon className="h-4 w-4" /> },
    { label: "Incoterms", value: str(s, "incoterms"), icon: <GlobeIcon className="h-4 w-4" /> },
  ].filter((t) => t.value);

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "orders", label: "Purchase Orders", count: data.purchaseOrders.length },
    { key: "bills", label: "Bills & Payments", count: data.bills.length + data.payments.length },
    { key: "products", label: "Products", count: data.products.length },
    { key: "quality", label: "Certifications" },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <header className="border-b border-[var(--border-subtle)]">
        <div className="mx-auto w-full max-w-6xl px-4 md:px-8 py-4">
          <Link
            href="/suppliers"
            className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            <span>All suppliers</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 md:px-8 py-6 md:py-10 space-y-10 pb-24">
        {/* ── Identity ── */}
        <section className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[var(--bg-surface-subtle)]">
            {str(s, "photo_url", "logo_url") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={str(s, "photo_url", "logo_url")} alt={name} className="h-full w-full object-cover" />
            ) : (
              <span className="font-mono text-2xl font-bold text-[var(--text-secondary)]">{initials(name)}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-faint)]">
              <Building2Icon className="h-3.5 w-3.5" />
              {str(s, "supplier_type") || "Supplier"}
            </div>
            <h1 className="mt-1 text-3xl md:text-4xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">{name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-[var(--text-secondary)]">
              {rating > 0 ? (
                <span className="inline-flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <StarIcon key={i} className={`h-3.5 w-3.5 ${i <= rating ? "text-[var(--text-primary)]" : "text-[var(--text-faint)]"}`} />
                  ))}
                </span>
              ) : null}
              {str(s, "country") ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPinIcon className="h-3.5 w-3.5 text-[var(--text-faint)]" />
                  {str(s, "country")}
                </span>
              ) : null}
              {/* Strategic status — editable pill */}
              {(() => {
                const ss = str(s, "strategic_status");
                const tone = strategicStatusTone(ss);
                const cls = ss
                  ? tone === "positive"
                    ? "bg-[var(--text-primary)] text-[var(--bg-primary)]"
                    : tone === "danger"
                      ? "bg-rose-500/10 text-rose-300"
                      : "bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)]"
                  : "bg-[var(--bg-surface-subtle)] text-[var(--text-faint)] hover:text-[var(--text-secondary)]";
                return (
                  <button
                    type="button"
                    onClick={() => { setStatusDraft(ss); setStatusReason(""); setStatusOpen((o) => !o); }}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${cls}`}
                  >
                    {ss ? (STRATEGIC_STATUS_LABELS[ss as StrategicStatus] ?? ss) : "Set status"}
                    <Edit3Icon className="h-3 w-3 opacity-70" />
                  </button>
                );
              })()}
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                  isActive ? "bg-[var(--bg-surface-subtle)] text-[var(--text-primary)]" : "bg-rose-500/10 text-rose-300"
                }`}
              >
                {isActive ? "Active" : "Archived"}
              </span>
            </div>

            {/* Strategic status editor */}
            {statusOpen ? (
              <div className="mt-3 max-w-md space-y-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(STRATEGIC_STATUS_LABELS) as StrategicStatus[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setStatusDraft(k)}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        statusDraft === k
                          ? "bg-[var(--text-primary)] text-[var(--bg-primary)]"
                          : "bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      {STRATEGIC_STATUS_LABELS[k]}
                    </button>
                  ))}
                </div>
                <input
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="Reason / internal note (optional)"
                  className="w-full rounded-lg bg-[var(--bg-surface-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none"
                />
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={savingStatus}
                    onClick={saveStatus}
                    className="rounded-lg bg-[var(--bg-inverted)] px-3 py-1.5 text-[12px] font-semibold text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-50"
                  >
                    {savingStatus ? "Saving…" : "Save status"}
                  </button>
                  <button type="button" onClick={() => setStatusOpen(false)} className="text-[12px] text-[var(--text-faint)] hover:text-[var(--text-secondary)]">
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            {/* Classifications — editable chips */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {data.classifications
                .slice()
                .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
                .map((c, i) => {
                  const val = str(c, "classification");
                  return (
                    <span
                      key={`${val}-${i}`}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        c.is_primary
                          ? "bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] ring-1 ring-[var(--border-subtle)]"
                          : "bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)]"
                      }`}
                    >
                      {classificationLabel(val)}
                      <button
                        type="button"
                        disabled={busyClass === val}
                        onClick={() => mutateClassification(val, "remove")}
                        className="text-[var(--text-faint)] hover:text-rose-400 disabled:opacity-40"
                        aria-label="Remove classification"
                      >
                        <CrossIcon className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setClassOpen((o) => !o)}
                  className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-surface-subtle)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-faint)] hover:text-[var(--text-primary)]"
                >
                  <PlusIcon className="h-3 w-3" /> Classification
                </button>
                {classOpen ? (
                  <div className="absolute z-10 mt-1 max-h-64 w-56 overflow-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1.5 shadow-lg">
                    {(Object.keys(CLASSIFICATION_LABELS) as (keyof typeof CLASSIFICATION_LABELS)[])
                      .filter((k) => !data.classifications.some((c) => str(c, "classification") === k))
                      .map((k) => (
                        <button
                          key={k}
                          type="button"
                          disabled={busyClass === k}
                          onClick={async () => { await mutateClassification(k, "add"); setClassOpen(false); }}
                          className="block w-full rounded-lg px-2.5 py-1.5 text-left text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)] disabled:opacity-50"
                        >
                          {CLASSIFICATION_LABELS[k]}
                        </button>
                      ))}
                    {(Object.keys(CLASSIFICATION_LABELS) as string[]).filter(
                      (k) => !data.classifications.some((c) => str(c, "classification") === k),
                    ).length === 0 ? (
                      <div className="px-2.5 py-2 text-[11px] text-[var(--text-faint)]">All classifications added</div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
            {editError ? <div className="mt-2 text-[11px] text-rose-400">{editError}</div> : null}
          </div>
        </section>

        {/* ── Commercial terms strip ── */}
        {terms.length > 0 ? (
          <section className="grid grid-cols-2 divide-x divide-y border-y border-[var(--border-subtle)] divide-[var(--border-subtle)] sm:grid-cols-3 md:grid-cols-5 md:divide-y-0">
            {terms.map((t) => (
              <div key={t.label} className="flex flex-col gap-2 px-4 py-5">
                <span className="text-[var(--text-faint)]">{t.icon}</span>
                <span className="text-base font-semibold leading-tight text-[var(--text-primary)]">{t.value}</span>
                <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--text-faint)]">{t.label}</span>
              </div>
            ))}
          </section>
        ) : null}

        {/* ── KPI row ── */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: "Total purchases", value: money(stats.totalPurchases, currency) },
            { label: "Outstanding payable", value: money(stats.outstanding, currency) },
            { label: "Open POs", value: String(stats.openPos) },
            { label: "Products supplied", value: String(stats.products) },
          ].map((k) => (
            <div key={k.label} className="rounded-2xl bg-[var(--bg-surface-subtle)] p-5">
              <div className="text-xl md:text-2xl font-semibold tracking-tight text-[var(--text-primary)]">{k.value}</div>
              <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--text-faint)]">{k.label}</div>
            </div>
          ))}
        </section>

        {/* ── Readiness score (computed completeness) ── */}
        {data.readiness ? (
          <section className="rounded-2xl bg-[var(--bg-surface-subtle)] p-6">
            <div className="flex items-center justify-between gap-4">
              <SectionHead eyebrow="Onboarding" title="Supplier readiness" />
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">{data.readiness.score}</span>
                <span className="text-sm font-medium text-[var(--text-faint)]">%</span>
              </div>
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-surface)]">
              <div className="h-full rounded-full bg-[var(--text-primary)]" style={{ width: `${Math.max(2, data.readiness.score)}%` }} />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
              {data.readiness.dimensions.map((d) => (
                <div key={d.key}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] font-medium text-[var(--text-secondary)]">{d.label}</span>
                    <span className="text-[11px] tabular-nums text-[var(--text-faint)]">{d.met}/{d.total}</span>
                  </div>
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[var(--bg-surface)]">
                    <div className="h-full rounded-full bg-[var(--text-secondary)]" style={{ width: `${Math.round(d.fraction * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* ── Performance scorecard ── */}
        <section className="space-y-4">
          <SectionHead eyebrow="Track record" title="Performance scorecard" />
          {!scorecard.hasHistory ? (
            <EmptyTab label="No purchasing history yet — on-time, lead-time, and return metrics appear once POs and receipts are recorded." />
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { label: "On-time delivery", value: scorecard.onTimePct === null ? "—" : `${scorecard.onTimePct}%`, meter: scorecard.onTimePct },
                { label: "Avg lead time", value: scorecard.avgLeadDays === null ? "—" : `${scorecard.avgLeadDays}`, unit: "days" },
                { label: "Returns", value: String(scorecard.returns), sub: scorecard.defects ? `${scorecard.defects} quality` : undefined },
                { label: "Return rate", value: scorecard.returnRate === null ? "—" : `${scorecard.returnRate}%` },
              ].map((k) => (
                <div key={k.label} className="rounded-2xl bg-[var(--bg-surface-subtle)] p-5">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl md:text-2xl font-semibold tracking-tight text-[var(--text-primary)]">{k.value}</span>
                    {"unit" in k && k.unit ? <span className="text-xs font-medium text-[var(--text-faint)]">{k.unit}</span> : null}
                  </div>
                  {"meter" in k && typeof k.meter === "number" ? (
                    <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-[var(--bg-surface)]">
                      <div className="h-full rounded-full bg-[var(--text-primary)]" style={{ width: `${Math.max(4, Math.min(100, k.meter))}%` }} />
                    </div>
                  ) : null}
                  <div className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--text-faint)]">{k.label}</div>
                  {"sub" in k && k.sub ? <div className="mt-0.5 text-[11px] text-[var(--text-faint)]">{k.sub}</div> : null}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Tabs ── */}
        <div className="flex flex-wrap gap-1 border-b border-[var(--border-subtle)]">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={`-mb-px border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors ${
                tab === tb.key
                  ? "border-[var(--text-primary)] text-[var(--text-primary)]"
                  : "border-transparent text-[var(--text-faint)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {tb.label}
              {typeof tb.count === "number" ? <span className="ms-1.5 text-[var(--text-faint)]">{tb.count}</span> : null}
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        {tab === "overview" ? (
          <section className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div className="space-y-3">
              <SectionHead title="Contact" />
              <div className="space-y-2.5 text-sm">
                {[
                  { icon: <EnvelopeIcon className="h-4 w-4" />, v: str(s, "supplier_email", "email") },
                  { icon: <PhoneIcon className="h-4 w-4" />, v: str(s, "supplier_tel", "phone", "supplier_mobile") },
                  { icon: <GlobeIcon className="h-4 w-4" />, v: str(s, "supplier_website", "website") },
                  { icon: <MapPinIcon className="h-4 w-4" />, v: [str(s, "city"), str(s, "province"), str(s, "country")].filter(Boolean).join(", ") || str(s, "supplier_address", "address") },
                ]
                  .filter((x) => x.v)
                  .map((x, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-[var(--text-secondary)]">
                      <span className="mt-0.5 text-[var(--text-faint)]">{x.icon}</span>
                      <span className="text-[var(--text-primary)]">{x.v}</span>
                    </div>
                  ))}
              </div>
            </div>
            {str(s, "notes") ? (
              <div className="space-y-3">
                <SectionHead title="Notes" />
                <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{str(s, "notes")}</p>
              </div>
            ) : null}
          </section>
        ) : null}

        {tab === "orders" ? (
          data.purchaseOrders.length === 0 ? (
            <EmptyTab label="No purchase orders linked to this supplier yet." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-left text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
                    <th className="py-2.5 pe-4 font-medium">Order</th>
                    <th className="py-2.5 pe-4 font-medium">Date</th>
                    <th className="py-2.5 pe-4 font-medium">Status</th>
                    <th className="py-2.5 text-end font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.purchaseOrders.map((p, i) => (
                    <tr key={str(p, "id") || i} className="border-b border-[var(--border-subtle)] last:border-0">
                      <td className="py-3 pe-4 font-medium text-[var(--text-primary)]">{str(p, "po_number", "number", "code", "id") || "—"}</td>
                      <td className="py-3 pe-4 text-[var(--text-secondary)]">{fmtDate(str(p, "order_date", "created_at", "date"))}</td>
                      <td className="py-3 pe-4"><StatusPill value={str(p, "status")} /></td>
                      <td className="py-3 text-end font-medium text-[var(--text-primary)]">{money(num(p, "total", "total_amount", "grand_total"), str(p, "currency") || currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}

        {tab === "bills" ? (
          <div className="space-y-8">
            <div className="space-y-3">
              <SectionHead eyebrow="Accounts payable" title="Vendor bills" />
              {data.bills.length === 0 ? (
                <EmptyTab label="No bills recorded for this supplier." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border-subtle)] text-left text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
                        <th className="py-2.5 pe-4 font-medium">Bill</th>
                        <th className="py-2.5 pe-4 font-medium">Due</th>
                        <th className="py-2.5 pe-4 font-medium">Status</th>
                        <th className="py-2.5 pe-4 text-end font-medium">Total</th>
                        <th className="py-2.5 text-end font-medium">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.bills.map((b, i) => (
                        <tr key={str(b, "id") || i} className="border-b border-[var(--border-subtle)] last:border-0">
                          <td className="py-3 pe-4 font-medium text-[var(--text-primary)]">{str(b, "bill_number", "number", "reference", "id") || "—"}</td>
                          <td className="py-3 pe-4 text-[var(--text-secondary)]">{fmtDate(str(b, "due_date"))}</td>
                          <td className="py-3 pe-4"><StatusPill value={str(b, "status")} /></td>
                          <td className="py-3 pe-4 text-end text-[var(--text-secondary)]">{money(num(b, "total", "total_amount"), str(b, "currency") || currency)}</td>
                          <td className="py-3 text-end font-medium text-[var(--text-primary)]">{money(num(b, "balance") || num(b, "total", "total_amount") - num(b, "amount_paid", "paid_amount"), str(b, "currency") || currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="space-y-3">
              <SectionHead eyebrow="Settlements" title="Payments" />
              {data.payments.length === 0 ? (
                <EmptyTab label="No payments recorded for this supplier." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border-subtle)] text-left text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
                        <th className="py-2.5 pe-4 font-medium">Date</th>
                        <th className="py-2.5 pe-4 font-medium">Reference</th>
                        <th className="py-2.5 pe-4 font-medium">Status</th>
                        <th className="py-2.5 text-end font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.payments.map((p, i) => (
                        <tr key={str(p, "id") || i} className="border-b border-[var(--border-subtle)] last:border-0">
                          <td className="py-3 pe-4 text-[var(--text-secondary)]">{fmtDate(str(p, "paid_at", "payment_date", "created_at"))}</td>
                          <td className="py-3 pe-4 text-[var(--text-primary)]">{str(p, "reference", "memo", "id") || "—"}</td>
                          <td className="py-3 pe-4"><StatusPill value={str(p, "status")} /></td>
                          <td className="py-3 text-end font-medium text-[var(--text-primary)]">{money(num(p, "amount"), str(p, "currency") || currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {tab === "products" ? (
          data.products.length === 0 ? (
            <EmptyTab label="No products are linked to this supplier yet." />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {data.products.map((p, i) => {
                const pid = str(p, "slug", "id");
                const card = (
                  <div className="rounded-2xl bg-[var(--bg-surface-subtle)] p-3 transition-colors hover:bg-[var(--bg-surface-hover)]">
                    <div className="aspect-square w-full overflow-hidden rounded-xl bg-[var(--bg-surface)]">
                      {str(p, "photo_url") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={str(p, "photo_url")} alt={str(p, "name")} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[var(--text-faint)]">
                          <PackageIcon className="h-7 w-7" />
                        </div>
                      )}
                    </div>
                    <div className="mt-2 truncate text-sm font-medium text-[var(--text-primary)]">{str(p, "name") || "Untitled"}</div>
                    {str(p, "primary_model") ? (
                      <div className="truncate font-mono text-[11px] text-[var(--text-faint)]">{str(p, "primary_model")}</div>
                    ) : null}
                  </div>
                );
                return pid ? (
                  <Link key={str(p, "id") || i} href={`/products/${pid}`}>{card}</Link>
                ) : (
                  <div key={i}>{card}</div>
                );
              })}
            </div>
          )
        ) : null}

        {tab === "quality" ? (
          <section className="space-y-6">
            <div className="space-y-3">
              <SectionHead eyebrow="Compliance" title="Certifications" />
              {certs.length === 0 ? (
                <EmptyTab label="No certifications recorded." />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {certs.map((c) => (
                    <span key={c} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-surface-subtle)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-primary)]">
                      <FileCheckIcon className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {(str(s, "sample_status") || str(s, "notes")) ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {str(s, "sample_status") ? (
                  <div className="space-y-2">
                    <SectionHead title="Sample status" />
                    <StatusPill value={str(s, "sample_status")} />
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}
      </main>
    </div>
  );
}

const EmptyTab = ({ label }: { label: string }) => (
  <div className="rounded-2xl bg-[var(--bg-surface-subtle)]/50 px-6 py-12 text-center text-sm text-[var(--text-faint)]">
    {label}
  </div>
);
