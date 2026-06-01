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
import { useTranslation } from "@/lib/i18n";
import { contactsT } from "@/lib/translations/contacts";
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
import TrashIcon from "@/components/icons/ui/TrashIcon";
import MoreHorizontalIcon from "@/components/icons/ui/MoreHorizontalIcon";
import MessageSquareIcon from "@/components/icons/ui/MessageSquareIcon";
import LandmarkIcon from "@/components/icons/ui/LandmarkIcon";
import IdCardIcon from "@/components/icons/ui/IdCardIcon";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import BarChart3Icon from "@/components/icons/ui/BarChart3Icon";
import HandCoinsIcon from "@/components/icons/ui/HandCoinsIcon";
import GaugeIcon from "@/components/icons/ui/GaugeIcon";
import TrendingUpIcon from "@/components/icons/ui/TrendingUpIcon";
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
import FactorySection from "./FactorySection";
import SuppliersHeader from "./SuppliersHeader";
import AutoTranslatedText from "@/components/ui/AutoTranslatedText";
import ContactsSection from "./ContactsSection";
import MediaSection from "./MediaSection";
import TimelineSection from "./TimelineSection";
import RiskSection from "./RiskSection";
import NegotiationSection from "./NegotiationSection";
import SourcingSection from "./SourcingSection";

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
  qrCodes: Row[];
  statusHistory: Row[];
  timeline: Row[];
  factory: Row | null;
  riskProfile: Row | null;
  riskItems: Row[];
  negotiations: Row[];
  negotiationIntel: Row | null;
  risk: { level: string | null; score: number | null; trustLevel: string | null; openItems: number; openHighRisks: number } | null;
  sourcingProfile: Row | null;
  sourcingLinks: Row[];
  specializations: Row[];
  sourcing: { score: number | null; priority: number | null; preferredProducts: number; blockedProducts: number; soleSource: boolean } | null;
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

const SectionHead = ({ eyebrow, title, icon }: { eyebrow?: string; title: string; icon?: React.ReactNode }) => (
  <div className="flex items-center gap-2.5">
    {icon ? (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)]">{icon}</span>
    ) : null}
    <div className="space-y-0.5">
      {eyebrow ? (
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{eyebrow}</div>
      ) : null}
      <h3 className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">{title}</h3>
    </div>
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

export default function SupplierDetail({ id, embedded = false, onEdit, onDelete }: { id: string; embedded?: boolean; onEdit?: () => void; onDelete?: () => void }) {
  const { t } = useTranslation(contactsT);
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

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
  const name = str(s, "company_name_en", "company_name", "display_name", "full_name") || t("sd.supplier", "Supplier");
  const cnName = str(s, "company_name_cn");
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
        <p className="text-sm text-[var(--text-secondary)]">{error ?? t("sd.supplierNotFound", "Supplier not found.")}</p>
        <button
          onClick={() => router.push("/suppliers")}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--bg-inverted)] px-4 py-2 text-[12px] font-semibold text-[var(--text-inverted)] hover:opacity-90"
        >
          <ArrowLeftIcon className="h-4 w-4" /> {t("sd.backToSuppliers", "Back to suppliers")}
        </button>
      </div>
    );
  }

  const terms: { label: string; value: string; icon: React.ReactNode }[] = [
    { label: t("sd.paymentTerms", "Payment terms"), value: str(s, "payment_terms"), icon: <WalletIcon className="h-4 w-4" /> },
    { label: t("sd.currency", "Currency"), value: str(s, "currency"), icon: <ReceiptIcon className="h-4 w-4" /> },
    { label: t("sd.moq", "MOQ"), value: str(s, "moq"), icon: <PackageIcon className="h-4 w-4" /> },
    { label: t("sd.leadTime", "Lead time"), value: str(s, "lead_time"), icon: <ShipIcon className="h-4 w-4" /> },
    { label: t("sd.incoterms", "Incoterms"), value: str(s, "incoterms"), icon: <GlobeIcon className="h-4 w-4" /> },
  ].filter((t) => t.value);

  const navItems: { id: string; label: string; count?: number }[] = [
    { id: "overview", label: t("sd.overview", "Overview") },
    { id: "factory", label: t("sd.factory", "Factory") },
    { id: "contacts", label: t("sd.contacts", "Contacts"), count: data.contactPersons.length },
    { id: "quality", label: t("sd.certifications", "Certifications") },
    { id: "risk", label: t("sd.risk", "Risk"), count: (data.riskItems ?? []).filter((r) => r.status !== "resolved").length },
    { id: "negotiation", label: t("sd.negotiation", "Negotiation"), count: (data.negotiations ?? []).length },
    { id: "sourcing", label: t("sd.sourcing", "Sourcing"), count: (data.sourcingLinks ?? []).length },
    { id: "products", label: t("sd.products", "Products"), count: data.products.length },
    { id: "orders", label: t("sd.purchaseOrders", "Purchase Orders"), count: data.purchaseOrders.length },
    { id: "bills", label: t("sd.billsPayments", "Bills & Payments"), count: data.bills.length + data.payments.length },
    { id: "documents", label: t("sd.documents", "Documents"), count: data.media.length },
    { id: "timeline", label: t("sd.timeline", "Timeline"), count: (data.timeline ?? []).length },
  ];

  return (
    <div className={embedded ? "h-full overflow-y-auto bg-[var(--bg-primary)]" : "min-h-screen bg-[var(--bg-primary)]"}>
      <div className={embedded ? "mx-auto w-full max-w-5xl" : "mx-auto w-full max-w-6xl"}>
        {!embedded && <div className="px-4 sm:px-6 pt-6"><SuppliersHeader title={t("sd.suppliers", "Suppliers")} /></div>}

      <main className="pb-24">
        {/* ─── Contacts-style centered header (avatar · name · type · edit/delete) — its own shell ─── */}
        <div className="mx-4 md:mx-6 mt-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 md:px-6 py-6 md:py-8 text-center">
          <div className="w-24 h-24 mx-auto mb-4 rounded-2xl bg-[var(--bg-surface-subtle)] ring-1 ring-[var(--border-subtle)] flex items-center justify-center overflow-hidden">
            {str(s, "photo_url", "logo_url") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={str(s, "photo_url", "logo_url")} alt={name} className="w-full h-full object-cover" />
            ) : (
              <span className="font-mono text-2xl font-bold text-[var(--text-secondary)]">{initials(name)}</span>
            )}
          </div>
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">{name}</h2>
          {cnName && cnName !== name ? (
            <p lang="zh" className="text-sm text-[var(--text-faint)] mt-0.5">{cnName}</p>
          ) : null}
          {rating > 0 ? (
            <div className="flex items-center justify-center gap-0.5 mt-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <StarIcon key={i} className={`h-3.5 w-3.5 ${i <= rating ? "text-amber-400" : "text-[var(--text-faint)]"}`} />
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3">
            <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full border border-[var(--border-subtle)] text-[var(--text-secondary)] inline-flex items-center gap-1">
              <Building2Icon className="h-3 w-3" /> {str(s, "supplier_type") || t("sd.supplier", "Supplier")}
            </span>
            {str(s, "country") ? (
              <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full border border-[var(--border-subtle)] text-[var(--text-secondary)] inline-flex items-center gap-1">
                <MapPinIcon className="h-3 w-3" /> {[str(s, "city"), str(s, "country")].filter(Boolean).join(", ")}
              </span>
            ) : null}
            {(() => {
              const ss = str(s, "strategic_status");
              const tone = strategicStatusTone(ss);
              const cls = ss
                ? tone === "positive"
                  ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border-emerald-500/25"
                  : tone === "danger"
                    ? "bg-rose-500/12 text-rose-600 dark:text-rose-400 border-rose-500/25"
                    : "bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)]"
                : "border-dashed border-[var(--border-subtle)] text-[var(--text-faint)] hover:text-[var(--text-secondary)]";
              return (
                <button type="button" onClick={() => { setStatusDraft(ss); setStatusReason(""); setStatusOpen((o) => !o); }} className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1 transition-colors ${cls}`}>
                  {ss ? (STRATEGIC_STATUS_LABELS[ss as StrategicStatus] ?? ss) : t("sd.setStatus", "Set status")}
                  <Edit3Icon className="h-3 w-3 opacity-70" />
                </button>
              );
            })()}
            <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${isActive ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 text-rose-500"}`}>
              {isActive ? t("sd.active", "Active") : t("sd.archived", "Archived")}
            </span>
          </div>

          {/* Strategic status editor (inline, like the original) */}
          {statusOpen ? (
            <div className="mt-4 max-w-md mx-auto space-y-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-start">
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(STRATEGIC_STATUS_LABELS) as StrategicStatus[]).map((k) => (
                  <button key={k} type="button" onClick={() => setStatusDraft(k)} className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${statusDraft === k ? "bg-[var(--text-primary)] text-[var(--bg-primary)]" : "bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>{STRATEGIC_STATUS_LABELS[k]}</button>
                ))}
              </div>
              <input value={statusReason} onChange={(e) => setStatusReason(e.target.value)} placeholder={t("sd.reasonPlaceholder", "Reason / internal note (optional)")} className="w-full rounded-lg bg-[var(--bg-surface-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none" />
              <div className="flex items-center gap-3">
                <button type="button" disabled={savingStatus} onClick={saveStatus} className="rounded-lg bg-[var(--bg-inverted)] px-3 py-1.5 text-[12px] font-semibold text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-50">{savingStatus ? t("sd.saving", "Saving…") : t("sd.saveStatus", "Save status")}</button>
                <button type="button" onClick={() => setStatusOpen(false)} className="text-[12px] text-[var(--text-faint)] hover:text-[var(--text-secondary)]">{t("sd.cancel", "Cancel")}</button>
              </div>
            </div>
          ) : null}

          {/* Classifications — kept editable like before */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
            {data.classifications.slice().sort((a, b) => Number(b.is_primary) - Number(a.is_primary)).map((c, i) => {
              const val = str(c, "classification");
              return (
                <span key={`${val}-${i}`} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${c.is_primary ? "bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] ring-1 ring-[var(--border-subtle)]" : "bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)]"}`}>
                  {classificationLabel(val)}
                  <button type="button" disabled={busyClass === val} onClick={() => mutateClassification(val, "remove")} className="text-[var(--text-faint)] hover:text-rose-400 disabled:opacity-40" aria-label={t("sd.removeClassification", "Remove classification")}>
                    <CrossIcon className="h-3 w-3" />
                  </button>
                </span>
              );
            })}
            <div className="relative">
              <button type="button" onClick={() => setClassOpen((o) => !o)} className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-surface-subtle)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--text-faint)] hover:text-[var(--text-primary)]">
                <PlusIcon className="h-3 w-3" /> {t("sd.classification", "Classification")}
              </button>
              {classOpen ? (
                <div className="absolute z-10 mt-1 max-h-64 w-56 overflow-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1.5 shadow-lg text-start">
                  {(Object.keys(CLASSIFICATION_LABELS) as (keyof typeof CLASSIFICATION_LABELS)[]).filter((k) => !data.classifications.some((c) => str(c, "classification") === k)).map((k) => (
                    <button key={k} type="button" disabled={busyClass === k} onClick={async () => { await mutateClassification(k, "add"); setClassOpen(false); }} className="block w-full rounded-lg px-2.5 py-1.5 text-left text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)] disabled:opacity-50">
                      {CLASSIFICATION_LABELS[k]}
                    </button>
                  ))}
                  {(Object.keys(CLASSIFICATION_LABELS) as string[]).filter((k) => !data.classifications.some((c) => str(c, "classification") === k)).length === 0 ? (
                    <div className="px-2.5 py-2 text-[11px] text-[var(--text-faint)]">{t("sd.allClassificationsAdded", "All classifications added")}</div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
          {editError ? <div className="mt-2 text-[11px] text-rose-400">{editError}</div> : null}

          {/* Action buttons (Edit / Delete) — Contacts grammar, centered */}
          <div className="flex items-center justify-center gap-2 mt-5">
            <button onClick={() => (onEdit ? onEdit() : router.push(`/suppliers?selected=${id}`))} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)] text-sm transition-colors text-[var(--text-primary)]">
              <Edit3Icon className="h-3.5 w-3.5" /> {t("sd.edit", "Edit")}
            </button>
            {onDelete ? (
              <button onClick={() => onDelete()} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 text-sm transition-colors">
                <TrashIcon className="h-3.5 w-3.5" /> {t("sd.delete", "Delete")}
              </button>
            ) : null}
          </div>

          {/* Quick actions (Call / Email / Website / WhatsApp) */}
          {(() => {
            const phone = str(s, "supplier_tel", "phone", "supplier_mobile", "mobile");
            const email = str(s, "supplier_email", "email");
            const site = str(s, "supplier_website", "website");
            const wa = str(s, "whatsapp_business");
            const actions: { key: string; label: string; icon: React.ReactNode; href: string; ext?: boolean; green?: boolean }[] = [];
            if (phone) actions.push({ key: "call", label: t("sd.call", "Call"), icon: <PhoneIcon className="h-4 w-4" />, href: `tel:${phone}` });
            if (email) actions.push({ key: "email", label: t("sd.email", "Email"), icon: <EnvelopeIcon className="h-4 w-4" />, href: `mailto:${email}` });
            if (site) actions.push({ key: "web", label: t("sd.website", "Website"), icon: <GlobeIcon className="h-4 w-4" />, href: site.startsWith("http") ? site : `https://${site}`, ext: true });
            if (wa) actions.push({ key: "wa", label: "WhatsApp", icon: <MessageSquareIcon className="h-4 w-4" />, href: `https://wa.me/${wa.replace(/[^0-9]/g, "")}`, ext: true, green: true });
            if (!actions.length) return null;
            return (
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                {actions.map((a) => (
                  <a key={a.key} href={a.href} {...(a.ext ? { target: "_blank", rel: "noreferrer" } : {})} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm transition-colors ${a.green ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15" : "bg-[var(--accent,#0066FF)]/10 text-[var(--accent,#0066FF)] hover:bg-[var(--accent,#0066FF)]/15"}`}>
                    {a.icon} {a.label}
                  </a>
                ))}
              </div>
            );
          })()}
        </div>

        {/* ─── KPI strip (Total / Outstanding / Open POs / Products) ─── */}
        <Sec title={t("sd.kpi", "Key metrics")} icon={<BarChart3Icon className="h-3.5 w-3.5" />}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: t("sd.totalPurchases", "Total purchases"), value: money(stats.totalPurchases, currency) },
              { label: t("sd.outstandingPayable", "Outstanding payable"), value: money(stats.outstanding, currency) },
              { label: t("sd.openPos", "Open POs"), value: String(stats.openPos) },
              { label: t("sd.productsSupplied", "Products supplied"), value: String(stats.products) },
            ].map((k) => (
              <div key={k.label} className="rounded-xl bg-[var(--bg-surface-subtle)] p-3.5">
                <div className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">{k.value}</div>
                <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--text-faint)]">{k.label}</div>
              </div>
            ))}
          </div>
        </Sec>

        {/* ─── Commercial terms (Payment / Currency / MOQ / Lead time / Incoterms) ─── */}
        {terms.length > 0 ? (
          <Sec title={t("sd.commercialTerms", "Commercial terms")} icon={<HandCoinsIcon className="h-3.5 w-3.5" />}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-x-6 gap-y-3">
              {terms.map((tm) => (
                <Field key={tm.label} label={tm.label} value={tm.value} />
              ))}
            </div>
          </Sec>
        ) : null}

        {/* ─── Onboarding readiness ─── */}
        {data.readiness ? (
          <Sec title={t("sd.supplierReadiness", "Supplier readiness")} icon={<GaugeIcon className="h-3.5 w-3.5" />}>
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] uppercase tracking-wider text-[var(--text-faint)]">{t("sd.onboarding", "Onboarding")}</span>
              <span className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">{data.readiness.score}<span className="text-sm font-medium text-[var(--text-faint)]">%</span></span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-surface-subtle)]">
              <div className="h-full rounded-full bg-[var(--text-primary)]" style={{ width: `${Math.max(2, data.readiness.score)}%` }} />
            </div>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
              {data.readiness.dimensions.map((d) => (
                <div key={d.key}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-[var(--text-secondary)]">{d.label}</span>
                    <span className="text-[11px] tabular-nums text-[var(--text-faint)]">{d.met}/{d.total}</span>
                  </div>
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[var(--bg-surface-subtle)]">
                    <div className="h-full rounded-full bg-[var(--text-secondary)]" style={{ width: `${Math.round(d.fraction * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Sec>
        ) : null}

        {/* ─── Performance scorecard ─── */}
        {scorecard.hasHistory ? (
          <Sec title={t("sd.performanceScorecard", "Performance scorecard")} icon={<TrendingUpIcon className="h-3.5 w-3.5" />}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: t("sd.onTimeDelivery", "On-time delivery"), value: scorecard.onTimePct === null ? "—" : `${scorecard.onTimePct}%`, meter: scorecard.onTimePct },
                { label: t("sd.avgLeadTime", "Avg lead time"), value: scorecard.avgLeadDays === null ? "—" : `${scorecard.avgLeadDays}`, unit: t("sd.days", "days") },
                { label: t("sd.returns", "Returns"), value: String(scorecard.returns), sub: scorecard.defects ? `${scorecard.defects} ${t("sd.quality", "quality")}` : undefined },
                { label: t("sd.returnRate", "Return rate"), value: scorecard.returnRate === null ? "—" : `${scorecard.returnRate}%` },
              ].map((k) => (
                <div key={k.label} className="rounded-xl bg-[var(--bg-surface-subtle)] p-3.5">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">{k.value}</span>
                    {"unit" in k && k.unit ? <span className="text-xs font-medium text-[var(--text-faint)]">{k.unit}</span> : null}
                  </div>
                  {"meter" in k && typeof k.meter === "number" ? (
                    <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-[var(--bg-surface)]">
                      <div className="h-full rounded-full bg-[var(--text-primary)]" style={{ width: `${Math.max(4, Math.min(100, k.meter))}%` }} />
                    </div>
                  ) : null}
                  <div className="mt-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--text-faint)]">{k.label}</div>
                  {"sub" in k && k.sub ? <div className="mt-0.5 text-[11px] text-[var(--text-faint)]">{k.sub}</div> : null}
                </div>
              ))}
            </div>
          </Sec>
        ) : null}


        {/* ── In-page jump navigation (sticky) — every section stays visible below ── */}
        <nav className="sticky top-0 z-20 mx-4 md:mx-6 mt-3 flex gap-1 overflow-x-auto rounded-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/95 px-2 py-1.5 backdrop-blur scrollbar-none">
          {navItems.map((n) => (
            <a
              key={n.id}
              href={`#${n.id}`}
              className="shrink-0 rounded-full px-3 py-1.5 text-[12px] font-medium text-[var(--text-faint)] transition-colors hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]"
            >
              {n.label}
              {typeof n.count === "number" && n.count > 0 ? <span className="ms-1 text-[var(--text-ghost)]">{n.count}</span> : null}
            </a>
          ))}
        </nav>

        {/* ═══ Everything below is one continuous page — no hidden tabs ═══ */}

        <GroupLabel>{t("sd.groupProfile", "Profile & operations")}</GroupLabel>

        {/* ─── Stacked Contacts-style sections (Sec + Field 2-col grid) ─── */}
        {(() => {
          const lst = (...keys: string[]): string => { for (const k of keys) { const v = (s as Row)[k]; if (Array.isArray(v) && v.length) return v.map(String).join(", "); } return ""; };
          const yn = (k: string): string => { const v = (s as Row)[k]; return v === true ? t("sd.yes", "Yes") : v === false ? t("sd.no", "No") : ""; };
          const addr = [str(s, "address_1", "supplier_address"), str(s, "city"), str(s, "province"), str(s, "country"), str(s, "supplier_postal_code")].filter(Boolean).join(", ");
          const banks = Array.isArray(s.bank_accounts) ? (s.bank_accounts as Row[]) : [];
          return (
            <div id="overview" className="scroll-mt-16">
              <Sec title={t("sd.contact", "Contact")} icon={<PhoneIcon className="h-3.5 w-3.5" />}>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <Field label={t("cs.mobile", "Mobile")} value={str(s, "supplier_mobile", "mobile")} mono />
                  <Field label={t("sd.phone", "Phone")} value={str(s, "supplier_tel", "phone")} mono />
                  <Field label={t("cs.email", "Email")} value={str(s, "supplier_email", "email")} span2 />
                  <Field label={t("sd.website", "Website")} value={str(s, "supplier_website", "website")} span2 />
                  <Field label={t("sd.address", "Address")} value={addr} span2 />
                  <Field label={t("cs.preferredLanguage", "Preferred language")} value={str(s, "language")} />
                </div>
              </Sec>

              <Sec title={t("sd.companyProfile", "Company profile")} icon={<Building2Icon className="h-3.5 w-3.5" />}>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <Field label={t("sd.legalName", "Legal name")} value={str(s, "legal_name", "company_name")} span2 />
                  <Field label={t("sd.tradingName", "Trading name")} value={str(s, "trading_name")} />
                  <Field label={t("sd.yearEstablished", "Year established")} value={str(s, "year_established")} />
                  <Field label={t("sd.companyTypeField", "Company type")} value={str(s, "company_type")} />
                  <Field label={t("sd.employees", "Employees")} value={str(s, "employee_count_range")} />
                  <Field label={t("sd.annualRevenue", "Annual revenue")} value={str(s, "annual_revenue_range")} />
                  <Field label={t("sd.industry", "Industry")} value={[str(s, "industry"), str(s, "sub_industry")].filter(Boolean).join(" · ")} />
                </div>
              </Sec>

              <Sec title={t("sd.identityCompliance", "Identity & compliance")} icon={<IdCardIcon className="h-3.5 w-3.5" />}>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <Field label={t("sd.businessRegNo", "Business reg. no.")} value={str(s, "business_registration_number")} mono />
                  <Field label={t("sd.taxId", "Tax ID / VAT")} value={str(s, "tax_id")} mono />
                  <Field label={t("sd.usci", "USCI / CR")} value={str(s, "cr_number")} mono />
                  <Field label={t("sd.eori", "EORI")} value={str(s, "eori_number")} mono />
                  <Field label={t("sd.duns", "DUNS")} value={str(s, "duns_number")} mono />
                  <Field label={t("sd.ieCode", "Import/Export code")} value={str(s, "importer_exporter_code")} mono />
                  <Field label={t("sd.customsCode", "Customs code")} value={str(s, "customs_code")} mono />
                  <Field label={t("sd.kyc", "KYC")} value={str(s, "kyc_status")} />
                  <Field label={t("sd.sanctions", "Sanctions check")} value={str(s, "sanctions_check_status")} />
                </div>
              </Sec>

              <Sec title={t("sd.logisticsTrade", "Logistics & trade")} icon={<ShipIcon className="h-3.5 w-3.5" />}>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <Field label={t("sd.incoterms", "Incoterms")} value={str(s, "incoterms")} />
                  <Field label={t("sd.portOfEntry", "Port")} value={str(s, "port_of_entry")} />
                  <Field label={t("sd.carriers", "Preferred carriers")} value={lst("preferred_carriers")} span2 />
                  <Field label={t("sd.container", "Container")} value={str(s, "container_preference")} />
                  <Field label={t("sd.hsCodes", "HS codes")} value={lst("hs_codes")} mono />
                  <Field label={t("sd.shippingMarks", "Shipping marks")} value={str(s, "shipping_marks")} span2 />
                  <Field label={t("sd.labeling", "Labeling")} value={str(s, "labeling_requirements")} span2 />
                </div>
              </Sec>

              <Sec title={t("sd.messaging", "Messaging")} icon={<MessageSquareIcon className="h-3.5 w-3.5" />}>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <Field label={t("cs.wechatId", "WeChat ID")} value={str(s, "wechat_id")} mono />
                  <Field label={t("sd.wechatOfficial", "WeChat official")} value={str(s, "wechat_official_account")} mono />
                  <Field label={t("sd.wechatGroup", "WeChat sales group")} value={yn("wechat_sales_group_available")} />
                  <Field label={t("sd.wecomSupport", "WeCom support")} value={yn("wecom_support_available")} />
                  <Field label="WhatsApp" value={str(s, "whatsapp_business")} mono />
                  <Field label="Telegram" value={str(s, "telegram_id")} mono />
                  <Field label="Line" value={str(s, "line_id")} mono />
                  <Field label="Skype" value={str(s, "skype_id")} mono />
                  <Field label="QQ" value={str(s, "qq_id")} mono />
                </div>
              </Sec>

              <Sec title={t("sd.banking", "Banking & payment")} icon={<LandmarkIcon className="h-3.5 w-3.5" />}>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <Field label={t("sd.paymentTerms", "Payment terms")} value={str(s, "payment_terms")} span2 />
                  <Field label={t("sd.preferredMethod", "Method")} value={str(s, "preferred_payment_method")} />
                  <Field label={t("sd.currency", "Currency")} value={str(s, "currency")} />
                </div>
                {banks.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {banks.map((b, i) => (
                      <div key={i} className="rounded-lg bg-[var(--bg-surface-subtle)] px-3 py-2.5 text-sm">
                        <div className="font-medium text-[var(--text-primary)]">{str(b, "bank")}</div>
                        <div className="mt-0.5 text-xs text-[var(--text-faint)]">{[str(b, "account_name"), str(b, "account_no"), str(b, "swift")].filter(Boolean).join(" · ")}</div>
                      </div>
                    ))}
                  </div>
                ) : str(s, "payment_info") ? (
                  <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">{str(s, "payment_info")}</p>
                ) : null}
              </Sec>

              <div id="quality" className="scroll-mt-16">
                <Sec title={t("sd.qualityCertifications", "Quality & certifications")} icon={<FileCheckIcon className="h-3.5 w-3.5" />}>
                  {certs.length ? (
                    <div className="flex flex-wrap gap-2">
                      {certs.map((c) => (
                        <span key={c} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-[12px] font-medium text-emerald-700 dark:text-emerald-400">
                          <FileCheckIcon className="h-3.5 w-3.5" /> {c}
                        </span>
                      ))}
                    </div>
                  ) : <p className="text-sm text-[var(--text-faint)]">{t("sd.noCertifications", "No certifications recorded.")}</p>}
                  {str(s, "sample_status") ? (
                    <div className="mt-3 flex items-center gap-2 text-xs">
                      <span className="text-[var(--text-faint)]">{t("sd.sampleStatus", "Sample status")}:</span>
                      <StatusPill value={str(s, "sample_status")} />
                    </div>
                  ) : null}
                </Sec>
              </div>

              {str(s, "notes") ? (
                <Sec title={t("sd.notes", "Notes")} icon={<DocumentIcon className="h-3.5 w-3.5" />}>
                  <p className="text-sm leading-relaxed text-[var(--text-secondary)]"><AutoTranslatedText text={str(s, "notes")} /></p>
                </Sec>
              ) : null}
            </div>
          );
        })()}

        {/* Factory */}
        <Section id="factory">
          <FactorySection supplierId={id} supplier={s} factory={data.factory} onSaved={() => load({ silent: true })} />
        </Section>

        {/* Contacts (people) */}
        <Section id="contacts">
          <ContactsSection supplierId={id} contactPersons={data.contactPersons} qrCodes={data.qrCodes ?? []} onSaved={() => load({ silent: true })} />
        </Section>

        <GroupLabel>{t("sd.groupCommercial", "Commercial intelligence")}</GroupLabel>

        {/* Risk */}
        <Section id="risk" noBorder>
          <RiskSection supplierId={id} riskProfile={data.riskProfile ?? null} riskItems={data.riskItems ?? []} risk={data.risk ?? null} onSaved={() => load({ silent: true })} />
        </Section>

        {/* Negotiation */}
        <Section id="negotiation">
          <NegotiationSection supplierId={id} negotiations={data.negotiations ?? []} negotiationIntel={data.negotiationIntel ?? null} onSaved={() => load({ silent: true })} />
        </Section>

        {/* Sourcing */}
        <Section id="sourcing">
          <SourcingSection
            supplierId={id}
            supplierName={str(s, "company_name_en") || str(s, "display_name") || t("sd.supplier", "Supplier")}
            sourcing={data.sourcing ?? null}
            sourcingProfile={data.sourcingProfile ?? null}
            sourcingLinks={data.sourcingLinks ?? []}
            specializations={data.specializations ?? []}
            onSaved={() => load({ silent: true })}
          />
        </Section>

        <GroupLabel>{t("sd.groupRecords", "Records & documents")}</GroupLabel>

        {/* Products supplied */}
        <Section id="products" noBorder>
          <SectionHead eyebrow={t("sd.catalogue", "Catalogue")} title={t("sd.productsSupplied", "Products supplied")} icon={<PackageIcon className="h-4 w-4" />} />
          <div className="mt-4">
            {data.products.length === 0 ? (
              <EmptyTab label={t("sd.noProducts", "No products are linked to this supplier yet.")} />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {data.products.map((p, i) => {
                  const pid = str(p, "slug", "id");
                  const card = (
                    <div className="rounded-2xl bg-[var(--bg-surface-subtle)] p-3 transition-colors hover:bg-[var(--bg-surface-hover)]">
                      <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-[var(--bg-surface)] text-[var(--text-faint)]">
                        <PackageIcon className="h-7 w-7" />
                      </div>
                      <div className="mt-2 truncate text-sm font-medium text-[var(--text-primary)]">{str(p, "product_name") || t("sd.untitled", "Untitled")}</div>
                      {str(p, "category_slug") ? <div className="truncate text-[11px] text-[var(--text-faint)]">{str(p, "category_slug")}</div> : null}
                    </div>
                  );
                  return pid ? <Link key={str(p, "id") || i} href={`/products/${pid}`}>{card}</Link> : <div key={i}>{card}</div>;
                })}
              </div>
            )}
          </div>
        </Section>

        {/* Purchase orders */}
        <Section id="orders">
          <SectionHead eyebrow={t("sd.purchasing", "Purchasing")} title={t("sd.purchaseOrders", "Purchase Orders")} icon={<ReceiptIcon className="h-4 w-4" />} />
          <div className="mt-4">
            {data.purchaseOrders.length === 0 ? (
              <EmptyTab label={t("sd.noPurchaseOrders", "No purchase orders linked to this supplier yet.")} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-left text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
                      <th className="py-2.5 pe-4 font-medium">{t("sd.order", "Order")}</th>
                      <th className="py-2.5 pe-4 font-medium">{t("sd.date", "Date")}</th>
                      <th className="py-2.5 pe-4 font-medium">{t("sd.status", "Status")}</th>
                      <th className="py-2.5 text-end font-medium">{t("sd.total", "Total")}</th>
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
            )}
          </div>
        </Section>

        {/* Bills & payments */}
        <Section id="bills">
          <div className="space-y-8">
            <div className="space-y-3">
              <SectionHead eyebrow={t("sd.accountsPayable", "Accounts payable")} title={t("sd.vendorBills", "Vendor bills")} icon={<WalletIcon className="h-4 w-4" />} />
              {data.bills.length === 0 ? (
                <EmptyTab label={t("sd.noBills", "No bills recorded for this supplier.")} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border-subtle)] text-left text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
                        <th className="py-2.5 pe-4 font-medium">{t("sd.bill", "Bill")}</th>
                        <th className="py-2.5 pe-4 font-medium">{t("sd.due", "Due")}</th>
                        <th className="py-2.5 pe-4 font-medium">{t("sd.status", "Status")}</th>
                        <th className="py-2.5 pe-4 text-end font-medium">{t("sd.total", "Total")}</th>
                        <th className="py-2.5 text-end font-medium">{t("sd.balance", "Balance")}</th>
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
              <SectionHead eyebrow={t("sd.settlements", "Settlements")} title={t("sd.payments", "Payments")} />
              {data.payments.length === 0 ? (
                <EmptyTab label={t("sd.noPayments", "No payments recorded for this supplier.")} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border-subtle)] text-left text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
                        <th className="py-2.5 pe-4 font-medium">{t("sd.date", "Date")}</th>
                        <th className="py-2.5 pe-4 font-medium">{t("sd.reference", "Reference")}</th>
                        <th className="py-2.5 pe-4 font-medium">{t("sd.status", "Status")}</th>
                        <th className="py-2.5 text-end font-medium">{t("sd.amount", "Amount")}</th>
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
        </Section>

        {/* Documents */}
        <Section id="documents">
          <MediaSection supplierId={id} media={data.media} onSaved={() => load({ silent: true })} />
        </Section>

        {/* Timeline */}
        <Section id="timeline">
          <TimelineSection supplierId={id} timeline={data.timeline ?? []} onSaved={() => load({ silent: true })} />
        </Section>
      </main>
      </div>
    </div>
  );
}

/* ─── Each section is its own SHELL — a rounded, bordered card surface that
   sets the section visually apart on the page. Uppercase mini-title + icon
   (Contacts grammar) sits at the top of the shell. */
const Sec = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
  <div className="mx-4 md:mx-6 my-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 md:px-5 py-4">
    <div className="flex items-center gap-2 mb-3">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)]">{icon}</span>
      <h3 className="text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider">{title}</h3>
    </div>
    {children}
  </div>
);

/* A label/value field cell — uppercase tiny label above the value, used inside
   2-column grids (grid-cols-2 gap-x-6 gap-y-3) like the customer detail. */
const Field = ({ label, value, span2, mono }: { label: string; value?: string | null; span2?: boolean; mono?: boolean }) => {
  if (!value || !String(value).trim()) return null;
  return (
    <div className={span2 ? "col-span-2" : ""}>
      <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{label}</span>
      <p className={`text-sm text-[var(--text-primary)] ${mono ? "font-mono" : ""} break-words`}>{value}</p>
    </div>
  );
};

const EmptyTab = ({ label }: { label: string }) => (
  <div className="rounded-2xl bg-[var(--bg-surface-subtle)]/50 px-6 py-12 text-center text-sm text-[var(--text-faint)]">
    {label}
  </div>
);

/* One stacked section on the single-page Supplier 360 — a top divider for clear
   separation and a scroll-margin so the sticky jump-nav doesn't overlap it.
   `noBorder` is used for the first section under a group label (the group
   label already provides the separation). */
const Section = ({ id, children }: { id: string; children: React.ReactNode; noBorder?: boolean }) => (
  <section id={id} className="scroll-mt-16 mx-4 md:mx-6 my-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 md:px-5 py-4">
    {children}
  </section>
);

/* iOS-Contacts grouped card: a titled rounded panel listing label→value rows.
   Rows with empty values are dropped; the whole card hides if nothing to show. */
const InfoCard = ({ icon, title, rows, children }: { icon: React.ReactNode; title: string; rows: { label: string; value?: string }[]; children?: React.ReactNode }) => {
  const filled = rows.filter((r) => r.value && r.value.trim());
  if (!filled.length && !children) return null;
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)]">{icon}</span>
        <h3 className="text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">{title}</h3>
      </div>
      <dl className="divide-y divide-[var(--border-faint)]">
        {filled.map((r) => (
          <div key={r.label} className="flex items-start justify-between gap-4 py-2">
            <dt className="shrink-0 text-[12.5px] text-[var(--text-faint)]">{r.label}</dt>
            <dd className="min-w-0 break-words text-end text-[13px] font-medium text-[var(--text-primary)]">{r.value}</dd>
          </div>
        ))}
      </dl>
      {children ? <div className="mt-2 space-y-2">{children}</div> : null}
    </div>
  );
};

/* Group heading — clusters the page into clear bands (Profile · Commercial ·
   Records) so a long single page still reads in an organized hierarchy. */
const GroupLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="mx-4 md:mx-6 mt-6 mb-1 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--text-faint)]">
    {children}
  </div>
);
