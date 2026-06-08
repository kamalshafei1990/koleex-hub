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
import ShieldCheckIcon from "@/components/icons/ui/ShieldCheckIcon";
import HandshakeIcon from "@/components/icons/ui/HandshakeIcon";
import {
  STRATEGIC_STATUS_LABELS,
  strategicStatusTone,
  classificationLabel,
  CLASSIFICATION_LABELS,
  type StrategicStatus,
} from "@/lib/suppliers/intelligence";
import Edit3Icon from "@/components/icons/ui/Edit3Icon";
import BrandGlyph from "@/components/icons/brands/BrandGlyph";
import TagsIcon from "@/components/icons/ui/TagsIcon";
import Share2Icon from "@/components/icons/ui/Share2Icon";
import AngleRightIcon from "@/components/icons/ui/AngleRightIcon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import XCircleIcon from "@/components/icons/ui/XCircleIcon";
import TriangleWarningIcon from "@/components/icons/ui/TriangleWarningIcon";
import { taxonomyLogoUrl } from "@/components/knowledge/product-coding/taxonomy-logo";
import { DIVISIONS, CATEGORIES } from "@/components/knowledge/product-coding/data";
import { fetchDivisionLogos, fetchCategoryLogos, fetchSubcategoryLogos } from "@/lib/products-admin";
import FactorySection from "./FactorySection";
import SuppliersHeader from "./SuppliersHeader";
import AutoTranslatedText from "@/components/ui/AutoTranslatedText";
import ContactsSection from "./ContactsSection";
import MediaSection from "./MediaSection";
import CatalogsSection from "./CatalogsSection";
import TimelineSection from "./TimelineSection";
import RiskSection from "./RiskSection";
import NegotiationSection from "./NegotiationSection";
import SourcingSection from "./SourcingSection";
import { kxInspectAttrs } from "@/lib/qa/inspector";

type Row = Record<string, unknown>;

/* Readiness WHY hints — generic, reusable per readiness dimension key.
   `why` = why this matters for sourcing; `nav` routes the operator to where
   the missing data is captured. Strings are translated with t() at render. */
const READINESS_HINTS: Record<string, { why: string; nav: "edit" | "documents" | "operations" | "financial" }> = {
  identity: { why: "Confirms this is a real, registered entity you can legally contract with.", nav: "edit" },
  commercial: { why: "Sets how you transact — without terms, every PO needs renegotiation.", nav: "edit" },
  factory: { why: "Proves real production capacity behind the quote, not just a trading desk.", nav: "edit" },
  certifications: { why: "Verified certificates are the basis of compliance and market access.", nav: "documents" },
  contacts: { why: "Reachable, ranked contacts keep sourcing moving when issues arise.", nav: "operations" },
  media: { why: "Photos and a logo make the supplier verifiable at a glance.", nav: "documents" },
  legal: { why: "KYC, tax ID and a live website are the minimum for onboarding approval.", nav: "edit" },
  operational: { why: "A real order/receipt/bill history is the strongest proof of a working relationship.", nav: "financial" },
};
const READINESS_NAV_TARGET: Record<string, string> = { documents: "documents", operations: "factory", financial: "orders" };
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
  readiness: { score: number; dimensions: { key: string; label: string; weight: number; met: number; total: number; fraction: number; checks?: { label: string; met: boolean }[] }[] };
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

export default function SupplierDetail({ id, embedded = false, onEdit, onDelete, onBack }: { id: string; embedded?: boolean; onEdit?: () => void; onDelete?: () => void; onBack?: () => void }) {
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

  /* Executive vs Analytical mode (Section 3) + progressive disclosure of the
     Level-B operational sections (Section 1). Executive mode collapses every
     Level-B section to a summary; Analytical mode shows them expanded. Each
     section can still be toggled individually. */
  const LEVEL_B_KEYS = ["companyProfile", "identity", "logistics", "social", "messagingSupport", "banking", "quality", "notes"];
  const [execMode, setExecMode] = useState(false);
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());
  // Readiness WHY layer — which incomplete dimensions are expanded.
  const [openDim, setOpenDim] = useState<Set<string>>(new Set());
  const toggleDim = (k: string) => setOpenDim((p) => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const toggleKey = useCallback((k: string) => {
    setCollapsedKeys((prev) => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  }, []);
  const setMode = useCallback((exec: boolean) => {
    setExecMode(exec);
    setCollapsedKeys(exec ? new Set(LEVEL_B_KEYS) : new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Scroll-spy — which of the 6 layers is currently in view, so the sticky
     nav highlights the active layer as the user scrolls (Section 3/7). */
  const [activeLayer, setActiveLayer] = useState<string>("overview");
  useEffect(() => {
    if (!data) return;
    const ids = ["overview", "factory", "risk", "orders", "documents", "timeline"];
    const els = ids.map((x) => document.getElementById(x)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActiveLayer((vis[0].target as HTMLElement).id);
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [data, id]);

  /* Division / category / subcategory icons — live from the same Supabase
     Storage the Product Data app reads, so any icon swapped there shows here
     immediately. Same source the customer/supplier form uses. */
  const [divisionLogos, setDivisionLogos] = useState<Record<string, string>>({});
  const [categoryLogos, setCategoryLogos] = useState<Record<string, string>>({});
  const [subcategoryLogos, setSubcategoryLogos] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    fetchDivisionLogos().then((m) => { if (alive) setDivisionLogos(m); }).catch(() => {});
    fetchCategoryLogos().then((m) => { if (alive) setCategoryLogos(m); }).catch(() => {});
    fetchSubcategoryLogos().then((m) => { if (alive) setSubcategoryLogos(m); }).catch(() => {});
    return () => { alive = false; };
  }, []);

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

  /* Shared field helpers for the grouped detail sections below. Lifted to
     component scope (out of the old section IIFE) so every section can be a
     free sibling and the page can be regrouped to mirror the add/edit form. */
  const lst = (...keys: string[]): string => { for (const k of keys) { const v = (s as Row)[k]; if (Array.isArray(v) && v.length) return v.map(String).join(", "); } return ""; };
  const yn = (k: string): string => { const v = (s as Row)[k]; return v === true ? t("sd.yes", "Yes") : v === false ? t("sd.no", "No") : ""; };
  const banks = Array.isArray(s.bank_accounts) ? (s.bank_accounts as Row[]) : [];

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

  // Grouped operational layers (Section 3 of the UX brief) — replaces the flat
  // 12-tab jump-nav. Each layer jumps to its lead section anchor; the counts
  // roll up the items inside that layer so the eye scans workflows, not tables.
  const openRisks = (data.riskItems ?? []).filter((r) => r.status !== "resolved").length;
  const navItems: { id: string; label: string; target: string; count?: number }[] = [
    { id: "overview", label: t("sd.layerOverview", "Overview"), target: "overview" },
    { id: "operations", label: t("sd.layerOperations", "Operations"), target: "factory", count: data.contactPersons.length + data.products.length },
    { id: "intelligence", label: t("sd.layerIntelligence", "Intelligence"), target: "risk", count: openRisks || undefined },
    { id: "financial", label: t("sd.layerFinancial", "Financial"), target: "orders", count: data.purchaseOrders.length + data.bills.length + data.payments.length || undefined },
    { id: "documents", label: t("sd.layerDocuments", "Documents"), target: "documents", count: data.media.length || undefined },
    { id: "activity", label: t("sd.layerActivity", "Activity"), target: "timeline", count: (data.timeline ?? []).length || undefined },
  ];

  return (
    <div className={embedded ? "h-full overflow-y-auto bg-[var(--bg-primary)]" : "min-h-screen bg-[var(--bg-primary)]"}>
      <div className={embedded ? "mx-auto w-full max-w-5xl" : "mx-auto w-full max-w-6xl"}>
        {!embedded && <div className="px-4 sm:px-6 pt-6"><SuppliersHeader title={t("sd.suppliers", "Suppliers")} /></div>}

      <main className="@container pb-24">
        {/* ─── Premium centered supplier identity hero with layered intelligence ───
              A calm, executive identity card — logo + name dominant, intelligence
              supporting underneath, and a soft-pill metric rail fused to the bottom
              edge. Not a dashboard table. ─── */}
        <div className="mx-4 md:mx-6 mt-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden">
          <div className="px-4 sm:px-8 md:px-10 pt-4">
            {/* Standalone breadcrumb — clear orientation + a real Back.
                Back returns to wherever you came from (e.g. Catalogs); the
                crumbs jump straight to Home or the Suppliers app. */}
            {!embedded && (
              <nav className="mb-3 flex items-center gap-1.5 text-[12px] text-[var(--text-dim)]">
                <button type="button" onClick={() => router.back()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]">
                  <ArrowLeftIcon className="h-3.5 w-3.5 rtl:rotate-180" /> {t("sd.back", "Back")}
                </button>
                <span className="mx-1 h-4 w-px bg-[var(--border-subtle)]" />
                <button type="button" onClick={() => router.push("/")} className="transition-colors hover:text-[var(--text-primary)]">{t("sd.home", "Home")}</button>
                <span className="text-[var(--text-faint)]">/</span>
                <button type="button" onClick={() => router.push("/suppliers")} className="transition-colors hover:text-[var(--text-primary)]">{t("sd.suppliers", "Suppliers")}</button>
                <span className="text-[var(--text-faint)]">/</span>
                <span className="truncate font-medium text-[var(--text-primary)] max-w-[45vw]">{name}</span>
              </nav>
            )}
            {/* Top bar — back + mode toggle (start) · Edit / Delete (end) */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
              {onBack ? (
                <button type="button" onClick={() => onBack()} aria-label={t("sd.backToOverview", "Back to overview")} title={t("sd.backToOverview", "Back to overview")}
                  className="flex items-center gap-1.5 shrink-0 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]">
                  <ArrowLeftIcon className="h-3.5 w-3.5 rtl:rotate-180" />
                  <span className="hidden sm:inline">{t("sd.overview", "Overview")}</span>
                </button>
              ) : null}
              <div className="inline-flex items-center rounded-lg bg-[var(--bg-surface-subtle)] p-0.5 text-[10.5px] font-medium">
                <button type="button" onClick={() => setMode(false)} aria-pressed={!execMode}
                  className={`rounded-md px-2 py-0.5 transition-colors ${!execMode ? "bg-[var(--bg-surface)] text-[var(--text-secondary)] shadow-sm" : "text-[var(--text-ghost)] hover:text-[var(--text-faint)]"}`}>
                  {t("sd.modeAnalytical", "Analytical")}
                </button>
                <button type="button" onClick={() => setMode(true)} aria-pressed={execMode}
                  className={`rounded-md px-2 py-0.5 transition-colors ${execMode ? "bg-[var(--bg-surface)] text-[var(--text-secondary)] shadow-sm" : "text-[var(--text-ghost)] hover:text-[var(--text-faint)]"}`}>
                  {t("sd.modeExecutive", "Executive")}
                </button>
              </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => (onEdit ? onEdit() : router.push(`/suppliers?selected=${id}`))} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)] text-[12px] font-medium transition-colors text-[var(--text-primary)]">
                  <Edit3Icon className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{t("sd.edit", "Edit")}</span>
                </button>
                {onDelete ? (
                  <button onClick={() => onDelete()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[12px] font-medium transition-colors" aria-label={t("sd.delete", "Delete")}>
                    <TrashIcon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{t("sd.delete", "Delete")}</span>
                  </button>
                ) : null}
              </div>
            </div>

            {/* ── Centered identity ── */}
            <div className="flex flex-col items-center text-center pt-1 pb-7 md:pb-8">
              <div className="w-24 h-24 rounded-2xl bg-[var(--bg-surface-subtle)] ring-1 ring-[var(--border-subtle)] shadow-[0_8px_30px_-12px_rgba(0,0,0,0.5)] flex items-center justify-center overflow-hidden">
                {str(s, "photo_url", "logo_url") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={str(s, "photo_url", "logo_url")} alt={name} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-mono text-2xl font-bold text-[var(--text-secondary)]">{initials(name)}</span>
                )}
              </div>

              <h2 className="mt-4 text-2xl md:text-[28px] font-semibold leading-tight tracking-tight text-[var(--text-primary)] max-w-2xl">{name}</h2>
              {cnName && cnName !== name ? (
                <p lang="zh" className="mt-1 text-[14px] text-[var(--text-faint)]">{cnName}</p>
              ) : null}

              {rating > 0 ? (
                <div className="flex items-center justify-center gap-0.5 mt-2.5" title={str(s, "strategic_status") === "blocked" ? t("sd.blockedRatingNote", "Supplier is blocked — rating shown for reference only") : undefined}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <StarIcon key={i} className={`h-3.5 w-3.5 ${str(s, "strategic_status") === "blocked" ? "text-[var(--text-faint)] opacity-50" : i <= rating ? "text-amber-400" : "text-[var(--text-faint)]"}`} />
                  ))}
                </div>
              ) : null}

              {/* type · location · strategic status · active */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 mt-4">
                <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full border border-[var(--border-subtle)] text-[var(--text-secondary)] inline-flex items-center gap-1">
                  <Building2Icon className="h-3 w-3" /> {str(s, "supplier_type") ? t("opt." + str(s, "supplier_type"), str(s, "supplier_type")) : t("sd.supplier", "Supplier")}
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

              {/* Blocked supplier — explicit warning so positive ratings/scores below
                  are never read as an endorsement (report Q). */}
              {str(s, "strategic_status") === "blocked" ? (
                <div className="mt-3.5 mx-auto flex max-w-xl items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/[0.08] px-3.5 py-2.5 text-start text-[12px] font-medium text-rose-600 dark:text-rose-300">
                  <TriangleWarningIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{t("sd.blockedWarning", "This supplier is BLOCKED. Ratings and scores below are shown for reference only — do not raise new orders without management approval.")}{str(s, "strategic_status_reason") ? ` — ${str(s, "strategic_status_reason")}` : ""}</span>
                </div>
              ) : null}

              {/* ── Category path + classifications (centered) ── */}
              {(() => {
                const slugify = (x: string) => x.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                const divName = str(s, "division");
                const catName = str(s, "category");
                const subInd = str(s, "sub_industry");
                const divObj = DIVISIONS.find((d) => d.name.toLowerCase() === divName.toLowerCase());
                const catObj = CATEGORIES.find((c) => c.label.toLowerCase() === catName.toLowerCase());
                const divKey = divObj?.id ?? slugify(divName);
                const catKey = catObj?.slug ?? slugify(catName);
                const subKey = slugify(subInd);
                const crumbs: { label: string; iconUrl?: string | null; fallback: React.ReactNode }[] = [];
                if (divName) crumbs.push({ label: divName, iconUrl: divisionLogos[divKey] ?? taxonomyLogoUrl("divisions", divKey), fallback: <Building2Icon className="h-3.5 w-3.5" /> });
                if (catName) crumbs.push({ label: catName, iconUrl: categoryLogos[catKey] ?? taxonomyLogoUrl("categories", catKey), fallback: <TagsIcon className="h-3.5 w-3.5" /> });
                if (subInd) crumbs.push({ label: subInd, iconUrl: subcategoryLogos[subKey] ?? taxonomyLogoUrl("subcategories", subKey), fallback: <FileCheckIcon className="h-3.5 w-3.5" /> });
                const typeNorm = str(s, "supplier_type").toLowerCase().replace(/[^a-z0-9]/g, "");
                const classes = data.classifications.slice()
                  .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
                  .filter((c) => classificationLabel(str(c, "classification")).toLowerCase().replace(/[^a-z0-9]/g, "") !== typeNorm);
                if (!crumbs.length && !classes.length) return null;
                return (
                  <div className="mt-3.5 space-y-2">
                    {crumbs.length ? (
                      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
                        {crumbs.map((c, i) => (
                          <span key={`${c.label}-${i}`} className="inline-flex items-center gap-1.5">
                            {i > 0 ? <AngleRightIcon className="h-3 w-3 text-[var(--text-ghost)] rtl:rotate-180" /> : null}
                            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--bg-surface-subtle)] ring-1 ring-[var(--border-subtle)]">
                              {c.iconUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={c.iconUrl} alt="" className="h-3.5 w-3.5 object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; const sib = e.currentTarget.nextElementSibling as HTMLElement | null; if (sib) sib.style.display = "inline-flex"; }} />
                              ) : null}
                              <span style={{ display: c.iconUrl ? "none" : "inline-flex" }} className="text-[var(--text-faint)]">{c.fallback}</span>
                            </span>
                            <span className="text-[12px] font-medium text-[var(--text-secondary)]">{c.label}</span>
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {classes.length ? (
                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                        {classes.map((c, i) => {
                          const val = str(c, "classification");
                          return (
                            <span key={`${val}-${i}`} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10.5px] font-medium ${c.is_primary ? "bg-[var(--accent,#0066FF)]/12 text-[var(--accent,#0066FF)] ring-1 ring-[var(--accent,#0066FF)]/25" : "bg-[var(--bg-surface-subtle)] text-[var(--text-faint)]"}`}>
                              {c.is_primary ? <StarIcon className="h-2.5 w-2.5" /> : null}
                              {classificationLabel(val)}
                            </span>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })()}

              {/* ── One clean intelligence strip — supports the hero, does not dominate ── */}
              {(() => {
                const rp = (data.riskProfile ?? {}) as Row;
                const ni = (data.negotiationIntel ?? {}) as Row;
                const tone = (k: "good" | "warn" | "bad" | "neutral") =>
                  k === "good" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : k === "warn" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : k === "bad" ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  : "bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)]";
                const badges: { label: string; k: "good" | "warn" | "bad" | "neutral" }[] = [];
                const lvl = str(rp, "risk_level");
                if (lvl) badges.push({ label: t("badge.risk." + lvl, `${lvl.toUpperCase()} RISK`), k: lvl === "low" ? "good" : lvl === "medium" ? "warn" : "bad" });
                const trust = str(rp, "trust_level");
                if (trust) badges.push({ label: trust === "excellent" || trust === "high" ? t("badge.trusted", "TRUSTED") : t("badge.trust." + trust, trust.toUpperCase() + " TRUST"), k: trust === "excellent" || trust === "high" ? "good" : trust === "medium" ? "warn" : "bad" });
                const negScore = num(ni, "negotiation_score");
                if (negScore) badges.push({ label: negScore >= 70 ? t("badge.negStrong", "STRONG NEGOTIATION") : negScore >= 40 ? t("badge.negModerate", "MODERATE NEGOTIATION") : t("badge.negWeak", "WEAK NEGOTIATION"), k: negScore >= 70 ? "good" : negScore >= 40 ? "warn" : "bad" });
                const ready = data.readiness?.score;
                if (typeof ready === "number") badges.push({ label: t("badge.ready", "READY {n}%").replace("{n}", String(ready)), k: ready >= 80 ? "good" : ready >= 50 ? "warn" : "bad" });
                const ss = str(s, "strategic_status");
                if (ss === "strategic" || ss === "preferred") badges.push({ label: ss === "strategic" ? t("badge.tier1", "TIER-1 SOURCE") : t("badge.preferred", "PREFERRED"), k: "good" });
                const prio = data.sourcing?.priority;
                if (typeof prio === "number" && prio > 0) badges.push({ label: t("badge.priority", "PRIORITY {n}").replace("{n}", String(prio)), k: "neutral" });
                if (data.sourcing?.soleSource) badges.push({ label: t("badge.soleSource", "SOLE SOURCE"), k: "warn" });
                if (!badges.length) return null;
                return (
                  <div className="mt-5 flex flex-wrap items-center justify-center gap-1.5 max-w-2xl">
                    {badges.map((b, i) => (
                      <span key={i} className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${tone(b.k)}`}>{b.label}</span>
                    ))}
                  </div>
                );
              })()}

              {/* Strategic status editor (inline, centered) */}
              {statusOpen ? (
                <div className="mt-5 w-full max-w-md space-y-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-start">
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
              {editError ? <div className="mt-3 text-[11px] text-rose-400">{editError}</div> : null}
            </div>
          </div>

          {/* ── Metric rail — soft pills fused to the bottom edge, not a side dashboard ── */}
          {(() => {
            const rp = (data.riskProfile ?? {}) as Row;
            const sp = (data.sourcingProfile ?? {}) as Row;
            const activeRisks = (data.riskItems ?? []).filter((r) => r.status !== "resolved").length;
            const sourcingScore = num(sp, "sourcing_score_override") || (data.sourcing?.score ?? 0);
            const evalScore = num(rp, "internal_evaluation_score");
            const readyPct = data.readiness?.score;
            const lastIso = (data.timeline ?? []).map((e) => str(e, "created_at")).filter(Boolean).sort().at(-1);
            const fmtDate = (iso?: string) => { if (!iso) return "—"; const d = new Date(iso); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" }); };
            const metrics: { label: string; value: string; accent?: "rose" | "emerald" }[] = [
              { label: t("sd.kpiSourcingScore", "Sourcing score"), value: sourcingScore ? `${Math.round(sourcingScore)}` : (evalScore ? `${Math.round(evalScore)}` : "—") },
              { label: t("sd.kpiReadiness", "Readiness"), value: typeof readyPct === "number" ? `${readyPct}%` : "—" },
              { label: t("sd.kpiActiveRisks", "Active risks"), value: String(activeRisks), accent: activeRisks ? "rose" : "emerald" },
              { label: t("sd.openPos", "Open POs"), value: String(stats.openPos) },
              { label: t("sd.outstandingPayable", "Outstanding"), value: money(stats.outstanding, currency) },
              { label: t("sd.leadTime", "Lead time"), value: str(s, "lead_time") || "—" },
              { label: t("sd.lastActivity", "Last activity"), value: fmtDate(lastIso) },
            ];
            return (
              <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/40 px-4 sm:px-6 py-3">
                <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
                  {metrics.map((m) => (
                    <span key={m.label} className="inline-flex items-baseline gap-1.5 rounded-full bg-[var(--bg-surface)] px-3 py-1.5 ring-1 ring-[var(--border-subtle)]/60">
                      <span className={`text-[13px] font-semibold tabular-nums leading-none ${m.accent === "rose" ? "text-rose-500" : m.accent === "emerald" ? "text-emerald-600 dark:text-emerald-400" : "text-[var(--text-primary)]"}`}>{m.value}</span>
                      <span className="text-[9.5px] font-medium uppercase tracking-wider text-[var(--text-faint)]">{m.label}</span>
                    </span>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Overview snapshot removed — Contact & channels / Commercial terms /
            Onboarding / Performance now live inside their groups below. */}


        {/* ── In-page layer navigation (sticky) — 6 operational layers, scan-first ── */}
        <nav className="sticky top-0 z-20 mx-4 md:mx-6 mt-3 flex gap-1 overflow-x-auto rounded-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/95 px-1.5 py-1.5 backdrop-blur scrollbar-none">
          {navItems.map((n) => {
            const active = n.target === activeLayer;
            return (
              <a
                key={n.id}
                href={`#${n.target}`}
                onClick={(e) => {
                  // The Hub scrolls inside .shell-content-offset, not the window,
                  // so plain #anchor jumps don't move. scrollIntoView walks to the
                  // real scroll container and scrolls smoothly to the section.
                  const el = typeof document !== "undefined" ? document.getElementById(n.target) : null;
                  if (el) { e.preventDefault(); el.scrollIntoView({ behavior: "smooth", block: "start" }); }
                }}
                aria-current={active ? "true" : undefined}
                className={`group/nav shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-colors ${
                  active
                    ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]"
                }`}
              >
                {n.label}
                {typeof n.count === "number" && n.count > 0 ? (
                  <span className={`inline-flex min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] tabular-nums ${active ? "bg-white/20 text-[var(--text-inverted)]" : "bg-[var(--bg-surface-subtle)] text-[var(--text-faint)] group-hover/nav:text-[var(--text-secondary)]"}`}>{n.count}</span>
                ) : null}
              </a>
            );
          })}
        </nav>

        {/* ═══ Everything below is one continuous page — no hidden tabs ═══ */}

        {/* ─── Detailed sections — grouped to mirror the add/edit form
            (Identity → Contacts → Commercial → Products → Legal → …) ─── */}
        <div id="overview" className="scroll-mt-16">
              <GroupLabel>{t("sd.groupIdentity", "Identity & profile")}</GroupLabel>
              <Sec title={t("sd.companyProfile", "Company profile")} kxComponent="SupplierCompanyProfileSection" kxSection="Identity & profile" kxRecordId={id} icon={<Building2Icon className="h-4 w-4" />} collapsible collapsed={collapsedKeys.has("companyProfile")} onToggle={() => toggleKey("companyProfile")} preview={[str(s, "company_type"), str(s, "year_established")].filter(Boolean).join(" · ")}>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <Field label={t("sd.legalName", "Legal name")} value={str(s, "legal_name", "company_name", "company_name_en")} span2 />
                  <Field label={t("sd.tradingName", "Trading name")} value={str(s, "trading_name")} />
                  <Field label={t("sd.yearEstablished", "Year established")} value={str(s, "year_established")} />
                  <Field label={t("sd.companyTypeField", "Company type")} value={str(s, "company_type")} />
                  <Field label={t("sd.employees", "Employees")} value={str(s, "employee_count_range", "employee_count")} />
                  <Field label={t("sd.annualRevenue", "Annual revenue")} value={str(s, "annual_revenue_range")} />
                  <Field label={t("sd.industry", "Industry")} value={[str(s, "industry"), str(s, "sub_industry")].filter(Boolean).join(" · ")} />
                </div>
                {(() => {
                  const brands = Array.isArray(s.brand_names) ? (s.brand_names as unknown[]).map(String).filter(Boolean) : [];
                  if (!brands.length) return null;
                  return (
                    <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
                      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-faint)] mb-2 flex items-center gap-1.5">
                        <TagsIcon className="h-3 w-3" />
                        {t("sd.brands", "Brands")}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {brands.map((b, i) => (
                          <span key={`${b}-${i}`} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-surface-subtle)] ring-1 ring-[var(--border-subtle)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)]">
                            <Building2Icon className="h-3 w-3 text-[var(--text-faint)]" />
                            {b}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </Sec>

              <GroupLabel>{t("sd.groupContacts", "Contacts & communication")}</GroupLabel>

              {/* Contact & channels — calls, email, address + per-platform messaging IDs / QRs */}
              {(() => {
                const phone = str(s, "supplier_tel", "phone");
                const mobile = str(s, "supplier_mobile", "mobile");
                const email = str(s, "supplier_email", "email");
                const site = str(s, "supplier_website", "website");
                const addr = [str(s, "address_1", "supplier_address"), str(s, "city"), str(s, "province"), str(s, "country"), str(s, "supplier_postal_code")].filter(Boolean).join(", ");
                type Channel = { key: string; label: string; brand: string; value?: string; qr?: string; href?: string };
                const channels: Channel[] = [
                  { key: "wechat", label: "WeChat", brand: "wechat", value: str(s, "wechat_id"), qr: str(s, "wechat_qr") },
                  { key: "wechat-official", label: t("sd.wechatOfficial", "WeChat official"), brand: "wechat", value: str(s, "wechat_official_account") },
                  ...(str(s, "whatsapp_business") || str(s, "whatsapp_qr") ? [{ key: "wa", label: "WhatsApp", brand: "whatsapp", value: str(s, "whatsapp_business"), qr: str(s, "whatsapp_qr"), href: str(s, "whatsapp_business") ? `https://wa.me/${str(s, "whatsapp_business").replace(/[^0-9]/g, "")}` : undefined } as Channel] : []),
                  ...(str(s, "telegram_id") || str(s, "telegram_qr") ? [{ key: "tg", label: "Telegram", brand: "telegram", value: str(s, "telegram_id"), qr: str(s, "telegram_qr"), href: str(s, "telegram_id").startsWith("@") ? `https://t.me/${str(s, "telegram_id").slice(1)}` : undefined } as Channel] : []),
                  { key: "line", label: "Line", brand: "line", value: str(s, "line_id"), qr: str(s, "line_qr") },
                  { key: "skype", label: "Skype", brand: "skype", value: str(s, "skype_id"), qr: str(s, "skype_qr"), href: str(s, "skype_id") ? `skype:${str(s, "skype_id")}?chat` : undefined },
                  { key: "qq", label: "QQ", brand: "qq", value: str(s, "qq_id"), qr: str(s, "qq_qr") },
                  { key: "dingtalk", label: "DingTalk", brand: "dingtalk", value: str(s, "dingtalk_id"), qr: str(s, "dingtalk_qr") },
                  { key: "messenger", label: "Messenger", brand: "messenger", value: str(s, "messenger_id"), qr: str(s, "messenger_qr") },
                ].filter((c) => c.value || c.qr);
                const mediaQrs = (data.media ?? []).filter((m: Row) => str(m, "media_class") === "qr_code");
                const hasAnything = phone || mobile || email || site || addr || channels.length || mediaQrs.length;
                if (!hasAnything) return null;
                return (
                  <Sec tone="default" title={t("sd.contactChannels", "Contact & channels")} kxComponent="SupplierContactSection" kxSection="Communication" kxRecordId={id} icon={<PhoneIcon className="h-4 w-4" />}>
                    <div className="grid grid-cols-1 @xl:grid-cols-2 gap-x-6 gap-y-3">
                      {mobile ? (
                        <a href={`tel:${mobile}`} className="flex items-center gap-2.5 group">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] group-hover:text-[var(--accent,#0066FF)] transition-colors"><PhoneIcon className="h-4 w-4" /></span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[10.5px] font-medium uppercase tracking-wider text-[var(--text-faint)]">{t("cs.mobile", "Mobile")}</span>
                            <span className="block truncate text-sm font-mono tabular-nums text-[var(--text-primary)] group-hover:text-[var(--accent,#0066FF)]">{mobile}</span>
                          </span>
                        </a>
                      ) : null}
                      {phone ? (
                        <a href={`tel:${phone}`} className="flex items-center gap-2.5 group">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] group-hover:text-[var(--accent,#0066FF)] transition-colors"><PhoneIcon className="h-4 w-4" /></span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[10.5px] font-medium uppercase tracking-wider text-[var(--text-faint)]">{t("sd.phone", "Phone")}</span>
                            <span className="block truncate text-sm font-mono tabular-nums text-[var(--text-primary)] group-hover:text-[var(--accent,#0066FF)]">{phone}</span>
                          </span>
                        </a>
                      ) : null}
                      {email ? (
                        <a href={`mailto:${email}`} className="flex items-center gap-2.5 group md:col-span-2">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] group-hover:text-[var(--accent,#0066FF)] transition-colors"><EnvelopeIcon className="h-4 w-4" /></span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[10.5px] font-medium uppercase tracking-wider text-[var(--text-faint)]">{t("cs.email", "Email")}</span>
                            <span className="block truncate text-sm text-[var(--text-primary)] group-hover:text-[var(--accent,#0066FF)]">{email}</span>
                          </span>
                        </a>
                      ) : null}
                      {site ? (
                        <a href={site.startsWith("http") ? site : `https://${site}`} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 group md:col-span-2">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] group-hover:text-[var(--accent,#0066FF)] transition-colors"><GlobeIcon className="h-4 w-4" /></span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[10.5px] font-medium uppercase tracking-wider text-[var(--text-faint)]">{t("sd.website", "Website")}</span>
                            <span className="block truncate text-sm text-[var(--text-primary)] group-hover:text-[var(--accent,#0066FF)]">{site}</span>
                          </span>
                        </a>
                      ) : null}
                      {addr ? (
                        <div className="flex items-start gap-2.5 md:col-span-2">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)]"><MapPinIcon className="h-4 w-4" /></span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[10.5px] font-medium uppercase tracking-wider text-[var(--text-faint)]">{t("sd.address", "Address")}</span>
                            <span className="block text-sm text-[var(--text-primary)] leading-snug">{addr}</span>
                          </span>
                        </div>
                      ) : null}
                    </div>

                    {channels.length > 0 ? (
                      <div className="mt-5 pt-5 border-t border-[var(--border-subtle)]">
                        <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-faint)] mb-3 flex items-center gap-1.5">
                          <MessageSquareIcon className="h-3 w-3" />
                          {t("sd.messaging", "Messaging")}
                        </div>
                        <div className="grid grid-cols-1 @2xl:grid-cols-2 gap-3">
                          {channels.map((c) => (
                            <div key={c.key} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 flex items-center gap-3.5">
                              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--bg-surface-subtle)] ring-1 ring-[var(--border-subtle)]">
                                <BrandGlyph name={c.brand} size={32} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-[13px] font-semibold text-[var(--text-primary)]">{c.label}</div>
                                {c.value ? (
                                  c.href ? (
                                    <a href={c.href} target={c.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="block truncate font-mono tabular-nums text-[12.5px] text-[var(--text-secondary)] hover:text-[var(--accent,#0066FF)]">{c.value}</a>
                                  ) : (
                                    <div className="truncate font-mono tabular-nums text-[12.5px] text-[var(--text-secondary)]">{c.value}</div>
                                  )
                                ) : (
                                  <div className="text-[12px] text-[var(--text-faint)] italic">{t("sd.scanQr", "Scan QR to connect")}</div>
                                )}
                              </div>
                              {c.qr ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={c.qr} alt={`${c.label} QR`} className="h-16 w-16 shrink-0 object-contain rounded-lg bg-white p-1 ring-1 ring-[var(--border-subtle)]" />
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {mediaQrs.length > 0 ? (
                      <div className="mt-5 pt-5 border-t border-[var(--border-subtle)]">
                        <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-faint)] mb-3 flex items-center gap-1.5">
                          <PackageIcon className="h-3 w-3" />
                          {t("sd.additionalQrs", "Additional QR codes")}
                        </div>
                        <div className="grid grid-cols-1 @2xl:grid-cols-2 gap-3">
                          {mediaQrs.map((m: Row, i: number) => {
                            const url = str(m, "file_url", "preview_url");
                            if (!url) return null;
                            const title = str(m, "title") || "QR";
                            const cat = str(m, "category");
                            const brand =
                              /wechat/i.test(title + " " + cat) ? "wechat" :
                              /whatsapp/i.test(title + " " + cat) ? "whatsapp" :
                              /wecom/i.test(title + " " + cat) ? "wechat" :
                              /alipay/i.test(title + " " + cat) ? "alipay" :
                              /telegram/i.test(title + " " + cat) ? "telegram" : "";
                            return (
                              <div key={`m-${i}`} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 flex items-center gap-3.5">
                                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--bg-surface-subtle)] ring-1 ring-[var(--border-subtle)]">
                                  {brand ? <BrandGlyph name={brand} size={32} /> : <PackageIcon className="h-6 w-6 text-[var(--text-faint)]" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{title}</div>
                                  {cat ? <div className="text-[11px] text-[var(--text-faint)] truncate capitalize">{cat}</div> : null}
                                </div>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={url} alt={title} className="h-16 w-16 shrink-0 object-contain rounded-lg bg-white p-1 ring-1 ring-[var(--border-subtle)]" />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </Sec>
                );
              })()}

              {/* Social media accounts — pulled from social_profiles jsonb on the
                  contact row. Each profile renders with a real brand glyph and
                  links out to the live profile when a URL is present. */}
              {(() => {
                type SP = { platform?: string; value?: string; url?: string; username?: string };
                const socials: SP[] = Array.isArray(s.social_profiles) ? (s.social_profiles as SP[]) : [];
                // Some tenants also store digital-presence URLs in dedicated
                // supplier_digital_presence columns; expose them here as well.
                const dp = (s as Row).digital_presence as Row | undefined;
                const fromDigital: SP[] = dp ? [
                  { platform: "LinkedIn", url: str(dp, "linkedin_url") },
                  { platform: "Facebook", url: str(dp, "facebook_url") },
                  { platform: "Instagram", url: str(dp, "instagram_url") },
                  { platform: "YouTube", url: str(dp, "youtube_url") },
                  { platform: "X", url: str(dp, "x_twitter_url") },
                  { platform: "TikTok", url: str(dp, "tiktok_url") },
                  { platform: "Douyin", url: str(dp, "douyin_url") },
                  { platform: "Alibaba", url: str(dp, "alibaba_url") },
                  { platform: "Made-in-China", url: str(dp, "made_in_china_url") },
                  { platform: "Global Sources", url: str(dp, "global_sources_url") },
                  { platform: "DHgate", url: str(dp, "dhgate_url") },
                ].filter((p) => p.url) : [];
                const all = [...socials, ...fromDigital].filter((p) => p.platform && (p.url || p.value || p.username));
                if (!all.length) return null;
                return (
                  <Sec tone="cyan" title={t("sd.socialMedia", "Social media & marketplaces")} kxComponent="SupplierSocialSection" kxSection="Communication" kxRecordId={id} icon={<Share2Icon className="h-4 w-4" />} collapsible collapsed={collapsedKeys.has("social")} onToggle={() => toggleKey("social")} preview={`${all.length}`}>
                    {/* Same big-logo card grammar as Messaging */}
                    <div className="grid grid-cols-1 @2xl:grid-cols-2 gap-3">
                      {all.map((p, i) => {
                        const label = p.platform ?? "";
                        const handle = p.username || p.value || "";
                        const url = p.url || "";
                        const display = handle || url.replace(/^https?:\/\//, "").replace(/\/$/, "");
                        const inner = (
                          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 flex items-center gap-3.5">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--bg-surface-subtle)] ring-1 ring-[var(--border-subtle)]">
                              <BrandGlyph name={label} size={32} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-[13px] font-semibold text-[var(--text-primary)]">{label}</div>
                              <div className="truncate text-[12.5px] text-[var(--text-secondary)] group-hover:text-[var(--accent,#0066FF)]">{display}</div>
                            </div>
                            {url ? <GlobeIcon className="h-4 w-4 shrink-0 text-[var(--text-faint)] group-hover:text-[var(--accent,#0066FF)]" /> : null}
                          </div>
                        );
                        return url ? (
                          <a key={`${label}-${i}`} href={url} target="_blank" rel="noreferrer" className="group block">{inner}</a>
                        ) : (
                          <div key={`${label}-${i}`}>{inner}</div>
                        );
                      })}
                    </div>
                  </Sec>
                );
              })()}

              {/* Messaging support & groups — yes/no flags that complement the
                  per-platform IDs+QRs in the hero Contact & channels shell. */}
              <Sec tone="cyan" title={t("sd.messagingSupport", "Messaging support & groups")} kxComponent="SupplierMessagingSection" kxSection="Communication" kxRecordId={id} icon={<MessageSquareIcon className="h-4 w-4" />} collapsible collapsed={collapsedKeys.has("messagingSupport")} onToggle={() => toggleKey("messagingSupport")} preview={str(s, "communication_preference")}>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <Field label={t("sd.wechatGroup", "WeChat sales group")} value={yn("wechat_sales_group_available")} />
                  <Field label={t("sd.wecomSupport", "WeCom support")} value={yn("wecom_support_available")} />
                  <Field label={t("sd.preferredCommunication", "Preferred channel")} value={str(s, "communication_preference")} />
                  <Field label={t("cs.preferredLanguage", "Preferred language")} value={str(s, "language")} />
                </div>
              </Sec>

              <Section id="contacts">
                <ContactsSection supplierId={id} contactPersons={data.contactPersons} qrCodes={data.qrCodes ?? []} onSaved={() => load({ silent: true })} />
              </Section>

              <GroupLabel>{t("sd.groupCommercialLogistics", "Commercial & logistics")}</GroupLabel>

              {terms.length > 0 ? (
                <Sec tone="violet" title={t("sd.commercialTerms", "Commercial terms")} kxComponent="SupplierCommercialSection" kxSection="Commercial" kxRecordId={id} icon={<HandCoinsIcon className="h-4 w-4" />}>
                  <div className="grid grid-cols-2 @2xl:grid-cols-3 @4xl:grid-cols-5 gap-x-6 gap-y-3">
                    {terms.map((tm) => (
                      <Field key={tm.label} label={tm.label} value={tm.value} />
                    ))}
                  </div>
                </Sec>
              ) : null}

              <Sec tone="amber" title={t("sd.logisticsTrade", "Logistics & trade")} kxComponent="SupplierLogisticsSection" kxSection="Commercial" kxRecordId={id} icon={<ShipIcon className="h-4 w-4" />} collapsible collapsed={collapsedKeys.has("logistics")} onToggle={() => toggleKey("logistics")} preview={[str(s, "port_of_entry"), str(s, "container_preference")].filter(Boolean).join(" · ")}>
                {/* Incoterms intentionally lives only in Commercial terms (single source). */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <Field label={t("sd.portOfEntry", "Port")} value={str(s, "port_of_entry")} />
                  <Field label={t("sd.carriers", "Preferred carriers")} value={lst("preferred_carriers")} span2 />
                  <Field label={t("sd.container", "Container")} value={str(s, "container_preference")} />
                  <Field label={t("sd.hsCodes", "HS codes")} value={lst("hs_codes")} mono />
                  <Field label={t("sd.shippingMarks", "Shipping marks")} value={str(s, "shipping_marks")} span2 />
                  <Field label={t("sd.labeling", "Labeling")} value={str(s, "labeling_requirements")} span2 />
                </div>
              </Sec>

              <Sec tone="violet" title={t("sd.banking", "Banking & payment")} kxComponent="SupplierBankingSection" kxSection="Commercial" kxRecordId={id} icon={<LandmarkIcon className="h-4 w-4" />} collapsible collapsed={collapsedKeys.has("banking")} onToggle={() => toggleKey("banking")} preview={str(s, "preferred_payment_method") || str(s, "payment_terms")}>
                {/* Payment terms + currency live in Commercial terms (single source);
                    this card focuses on HOW to pay — method + bank accounts. */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <Field label={t("sd.preferredMethod", "Method")} value={str(s, "preferred_payment_method")} span2 />
                </div>
                {banks.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {banks.map((b, i) => (
                      <div key={i} className="rounded-lg bg-[var(--bg-surface-subtle)] px-3 py-2.5 text-sm">
                        <div className="flex items-center gap-2">
                          <LandmarkIcon className="h-3.5 w-3.5 text-[var(--text-faint)]" />
                          <span className="font-medium text-[var(--text-primary)]">{str(b, "bank")}</span>
                        </div>
                        <div className="mt-0.5 text-xs text-[var(--text-faint)] font-mono tabular-nums">{[str(b, "account_name"), str(b, "account_no"), str(b, "swift")].filter(Boolean).join(" · ")}</div>
                      </div>
                    ))}
                  </div>
                ) : str(s, "payment_info") ? (
                  <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">{str(s, "payment_info")}</p>
                ) : null}
                {(() => {
                  const wcPayQr = str(s, "wechat_pay_qr");
                  const aliQr = str(s, "alipay_qr");
                  const wcPayId = str(s, "wechat_pay_id");
                  const aliId = str(s, "alipay_id");
                  if (!wcPayQr && !aliQr && !wcPayId && !aliId) return null;
                  return (
                    <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
                      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-faint)] mb-3 flex items-center gap-1.5">
                        <WalletIcon className="h-3 w-3" />
                        {t("sd.digitalPay", "Digital payment")}
                      </div>
                      {/* Each payment method → its own card; ID + QR side-by-side */}
                      <div className="grid grid-cols-1 @2xl:grid-cols-2 gap-3">
                        {(wcPayId || wcPayQr) ? (
                          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2.5 flex items-center gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wider text-[var(--text-faint)] mb-0.5">
                                <BrandGlyph name="wechat" size={11} />
                                WeChat Pay
                              </div>
                              {wcPayId ? <div className="font-mono text-sm text-[var(--text-primary)] truncate">{wcPayId}</div> : <div className="text-xs text-[var(--text-faint)] italic">{t("sd.scanQrToPay", "Scan QR to pay")}</div>}
                            </div>
                            {wcPayQr ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={wcPayQr} alt="WeChat Pay" className="h-16 w-16 shrink-0 object-contain rounded-md bg-white p-0.5" />
                            ) : null}
                          </div>
                        ) : null}
                        {(aliId || aliQr) ? (
                          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2.5 flex items-center gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wider text-[var(--text-faint)] mb-0.5">
                                <BrandGlyph name="alipay" size={11} />
                                Alipay
                              </div>
                              {aliId ? <div className="font-mono text-sm text-[var(--text-primary)] truncate">{aliId}</div> : <div className="text-xs text-[var(--text-faint)] italic">{t("sd.scanQrToPay", "Scan QR to pay")}</div>}
                            </div>
                            {aliQr ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={aliQr} alt="Alipay" className="h-16 w-16 shrink-0 object-contain rounded-md bg-white p-0.5" />
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })()}
              </Sec>

              <GroupLabel>{t("sd.groupProducts", "Products & production")}</GroupLabel>

              <div id="quality" className="scroll-mt-16">
                <Sec tone="emerald" title={t("sd.qualityCertifications", "Quality & certifications")} kxComponent="SupplierQualitySection" kxSection="Production" kxRecordId={id} icon={<FileCheckIcon className="h-4 w-4" />} collapsible collapsed={collapsedKeys.has("quality")} onToggle={() => toggleKey("quality")} preview={certs.length ? `${certs.length}` : ""}>
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

              {/* Factory / production capacity */}
              <Section id="factory">
                <FactorySection supplierId={id} supplier={s} factory={data.factory} onSaved={() => load({ silent: true })} />
              </Section>

              <GroupLabel>{t("sd.groupLegal", "Legal & compliance")}</GroupLabel>

              <Sec tone="violet" title={t("sd.identityCompliance", "Identity & compliance")} kxComponent="SupplierComplianceSection" kxSection="Legal" kxRecordId={id} icon={<IdCardIcon className="h-4 w-4" />} collapsible collapsed={collapsedKeys.has("identity")} onToggle={() => toggleKey("identity")} preview={str(s, "kyc_status") ? `KYC ${str(s, "kyc_status")}` : ""}>
                <div className="grid grid-cols-1 @3xl:grid-cols-[1fr_180px] gap-5">
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
                  {str(s, "business_license_image") ? (
                    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2 self-start">
                      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-faint)] mb-2 px-1 flex items-center gap-1.5">
                        <FileCheckIcon className="h-3 w-3" />
                        {t("sd.businessLicense", "Business license")}
                      </div>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={str(s, "business_license_image")} alt={t("sd.businessLicense", "Business license")} className="w-full aspect-[4/3] object-contain rounded-lg bg-white" />
                    </div>
                  ) : null}
                </div>
              </Sec>
            </div>

        <GroupLabel>{t("sd.groupIntelligence", "Intelligence")}</GroupLabel>

        {/* ─── Onboarding readiness ─── */}
        {data.readiness ? (
          <Sec tone="default" title={t("sd.supplierReadiness", "Onboarding readiness")} icon={<GaugeIcon className="h-4 w-4" />}>
            {(() => {
              const score = data.readiness.score;
              const tone = score >= 80 ? "emerald" : score >= 50 ? "amber" : "rose";
              const ring = tone === "emerald" ? "text-emerald-500" : tone === "amber" ? "text-amber-500" : "text-rose-500";
              const txt = tone === "emerald" ? "text-emerald-600 dark:text-emerald-400" : tone === "amber" ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400";
              const R = 30, C = 2 * Math.PI * R;
              const dims = data.readiness.dimensions.slice().sort((a, b) => a.fraction - b.fraction);
              const blocked = dims.filter((d) => d.fraction < 0.5).length;
              return (
                <div className="grid grid-cols-1 @xl:grid-cols-[auto_1fr] gap-5 @xl:gap-6 items-center">
                  {/* Radial gauge */}
                  <div className="flex items-center gap-4 md:flex-col md:gap-2 md:w-32">
                    <div className="relative h-[88px] w-[88px] shrink-0">
                      <svg viewBox="0 0 72 72" className="h-full w-full -rotate-90">
                        <circle cx="36" cy="36" r={R} fill="none" strokeWidth="7" className="stroke-[var(--bg-surface-subtle)]" />
                        <circle cx="36" cy="36" r={R} fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" className={ring} strokeDasharray={C} strokeDashoffset={C - (C * Math.max(0, Math.min(100, score))) / 100} />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={`text-xl font-bold tabular-nums ${txt}`}>{score}<span className="text-[11px] font-medium text-[var(--text-faint)]">%</span></span>
                      </div>
                    </div>
                    <div className="md:text-center">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">{t("sd.onboarding", "Onboarding")}</div>
                      <div className={`text-[11px] font-medium ${txt}`}>
                        {blocked > 0 ? t("sd.blocksRemaining", "{n} areas blocking").replace("{n}", String(blocked)) : t("sd.readyToApprove", "Ready to approve")}
                      </div>
                    </div>
                  </div>
                  {/* Dimension matrix — incomplete first; incomplete dims expand to a WHY layer */}
                  <div className="grid grid-cols-1 @2xl:grid-cols-2 gap-2">
                    {dims.map((d) => {
                      const pct = Math.round(d.fraction * 100);
                      const st = d.fraction >= 0.9 ? "complete" : d.fraction >= 0.5 ? "pending" : "blocked";
                      const stCls = st === "complete" ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400" : st === "pending" ? "bg-amber-500/12 text-amber-600 dark:text-amber-400" : "bg-rose-500/12 text-rose-600 dark:text-rose-400";
                      const barCls = st === "complete" ? "bg-emerald-500" : st === "pending" ? "bg-amber-500" : "bg-rose-500";
                      const stLabel = st === "complete" ? t("sd.rdComplete", "Complete") : st === "pending" ? t("sd.rdPending", "Pending") : t("sd.rdBlocked", "Blocked");
                      const incomplete = d.fraction < 1;
                      const isOpen = openDim.has(d.key);
                      const hint = READINESS_HINTS[d.key];
                      const missing = (d.checks ?? []).filter((c) => !c.met);
                      const navTo = () => {
                        const nav = hint?.nav;
                        if (!nav || nav === "edit") { onEdit ? onEdit() : router.push(`/suppliers?selected=${id}`); return; }
                        const target = READINESS_NAV_TARGET[nav];
                        const el = target ? document.getElementById(target) : null;
                        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                      };
                      return (
                        <div key={d.key} className={`rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] ${isOpen ? "sm:col-span-2" : ""}`}>
                          {incomplete ? (
                            <button type="button" onClick={() => toggleDim(d.key)} aria-expanded={isOpen} className="w-full px-3 py-2.5 text-start">
                              <div className="flex items-center justify-between gap-2">
                                <span className="flex items-center gap-1.5 min-w-0">
                                  <AngleDownIcon className={`h-3 w-3 shrink-0 text-[var(--text-faint)] transition-transform ${isOpen ? "" : "-rotate-90 rtl:rotate-90"}`} />
                                  <span className="text-[12px] font-medium text-[var(--text-primary)] truncate">{d.label}</span>
                                </span>
                                <span className={`shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${stCls}`}>{stLabel}</span>
                              </div>
                              <div className="mt-1.5 flex items-center gap-2">
                                <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--bg-surface-subtle)]">
                                  <div className={`h-full rounded-full ${barCls}`} style={{ width: `${Math.max(3, pct)}%` }} />
                                </div>
                                <span className="text-[10px] tabular-nums text-[var(--text-faint)]">{d.met}/{d.total}</span>
                              </div>
                            </button>
                          ) : (
                            <div className="px-3 py-2.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[12px] font-medium text-[var(--text-primary)] truncate ps-[18px]">{d.label}</span>
                                <span className={`shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${stCls}`}>{stLabel}</span>
                              </div>
                              <div className="mt-1.5 flex items-center gap-2">
                                <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--bg-surface-subtle)]">
                                  <div className={`h-full rounded-full ${barCls}`} style={{ width: `${Math.max(3, pct)}%` }} />
                                </div>
                                <span className="text-[10px] tabular-nums text-[var(--text-faint)]">{d.met}/{d.total}</span>
                              </div>
                            </div>
                          )}
                          {/* WHY layer */}
                          {incomplete && isOpen ? (
                            <div className="border-t border-[var(--border-subtle)] px-3 py-3 space-y-2.5">
                              {hint ? <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">{t("rdWhy." + d.key, hint.why)}</p> : null}
                              {missing.length ? (
                                <div>
                                  <div className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-faint)] mb-1">{t("sd.rdMissing", "Still missing")}</div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {missing.map((c, i) => (
                                      <span key={i} className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-0.5 text-[10.5px] font-medium text-rose-600 dark:text-rose-300">
                                        <XCircleIcon className="h-2.5 w-2.5" />{t("rdChk." + c.label, c.label)}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                              <button type="button" onClick={navTo} className="inline-flex items-center gap-1 rounded-lg bg-[var(--bg-inverted)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-inverted)] hover:opacity-90">
                                {t("sd.rdComplete2", "Complete this")} <AngleRightIcon className="h-3 w-3 rtl:rotate-180" />
                              </button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </Sec>
        ) : null}

        {/* ─── Performance scorecard ─── */}
        {scorecard.hasHistory ? (
          <Sec tone="cyan" title={t("sd.performanceScorecard", "Performance scorecard")} icon={<TrendingUpIcon className="h-4 w-4" />}>
            <div className="grid grid-cols-2 @2xl:grid-cols-4 gap-3">
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

        {/* Risk — one shell: hero overall bar + visual summary + intelligence editor */}
        <div id="risk" className="scroll-mt-16">
        <Sec tone="rose" title={t("sd.risk", "Risk")} icon={<ShieldCheckIcon className="h-4 w-4" />}>
          {(() => {
            const rp = (data.riskProfile ?? {}) as Row;
            const overall = num(rp, "internal_evaluation_score");
            const riskScore = data.risk?.score ?? null;
            const level = str(rp, "risk_level");
            const trust = str(rp, "trust_level");
            const dep = str(rp, "dependency_level");
            const backup = rp.backup_supplier_exists === true;
            const openItems = data.risk?.openItems ?? (data.riskItems ?? []).filter((r) => r.status !== "resolved").length;
            const openHigh = data.risk?.openHighRisks ?? 0;
            const lev: Record<string, number> = { low: 25, medium: 50, high: 75, critical: 95 };
            const trustLev: Record<string, number> = { low: 25, medium: 50, high: 80, excellent: 95 };
            const depLev: Record<string, number> = { low: 25, medium: 50, high: 75, critical: 95 };
            const stability = [
              { key: "financial_stability", label: t("sd.financialStability", "Financial stability") },
              { key: "communication_quality", label: t("sd.communicationQuality", "Communication") },
              { key: "delivery_stability", label: t("sd.deliveryStability", "Delivery") },
              { key: "quality_stability", label: t("sd.qualityStability", "Quality") },
              { key: "response_speed", label: t("sd.responseSpeed", "Response speed") },
            ];
            const heroPct = overall || (riskScore != null ? riskScore : 0);
            const heroTone: "emerald" | "amber" | "rose" = heroPct >= 75 ? "emerald" : heroPct >= 50 ? "amber" : "rose";
            const heroToneRing = heroTone === "emerald" ? "ring-emerald-500/30 bg-emerald-500/8" : heroTone === "amber" ? "ring-amber-500/30 bg-amber-500/8" : "ring-rose-500/30 bg-rose-500/8";
            const heroToneText = heroTone === "emerald" ? "text-emerald-600 dark:text-emerald-400" : heroTone === "amber" ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400";
            const heroToneFill = heroTone === "emerald" ? "bg-emerald-500" : heroTone === "amber" ? "bg-amber-500" : "bg-rose-500";
            const heroLabel = level || (heroPct >= 75 ? t("sd.low", "Low") : heroPct >= 50 ? t("sd.medium", "Medium") : t("sd.high", "High"));
            return (
              <div className="space-y-5">
                {/* Hero overall risk rating bar */}
                <div className={`rounded-2xl ring-1 ${heroToneRing} px-4 py-4`}>
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-faint)] flex items-center gap-1.5">
                        <ShieldCheckIcon className="h-3 w-3" />
                        {t("sd.overallRiskRating", "Overall risk rating")}
                      </div>
                      <div className={`mt-1 text-[11px] font-medium ${heroToneText} capitalize`}>{heroLabel}</div>
                    </div>
                    <div className={`text-3xl font-bold tabular-nums ${heroToneText}`}>
                      {Math.round(heroPct)}<span className="text-base font-medium text-[var(--text-faint)]">/100</span>
                    </div>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-surface)]">
                    <div className={`h-full rounded-full ${heroToneFill}`} style={{ width: `${Math.max(4, Math.min(100, heroPct))}%` }} />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2">
                  <BarRow label={t("sd.evaluationScore", "Evaluation score")} pct={overall || 0} tone={overall >= 75 ? "emerald" : overall >= 50 ? "amber" : "rose"} valueText={overall ? `${Math.round(overall)}/100` : "—"} />
                  {/* "Risk score" row removed: data.risk.score is the same internal_evaluation_score
                      already shown as "Evaluation score" above — rendering it again with inverted
                      (higher = worse) coloring produced a self-contradictory 88 green / 88 red pair. */}
                  {level ? <BarRow label={t("sd.overallRiskLevel", "Overall risk level")} pct={lev[level] ?? 50} tone={level === "low" ? "emerald" : level === "medium" ? "amber" : "rose"} valueText={t("opt." + level, level)} /> : null}
                  {trust ? <BarRow label={t("sd.trustLevel", "Trust level")} pct={trustLev[trust] ?? 50} tone={trust === "excellent" || trust === "high" ? "emerald" : trust === "medium" ? "amber" : "rose"} valueText={t("opt." + trust, trust)} /> : null}
                  {dep ? <BarRow label={t("sd.dependencyLevel", "Dependency level")} pct={depLev[dep] ?? 50} tone={dep === "low" ? "emerald" : dep === "medium" ? "amber" : "rose"} valueText={t("opt." + dep, dep)} /> : null}
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-faint)] mb-2.5">{t("sd.stabilityQuality", "Stability & quality")}</div>
                  <div className="grid grid-cols-1 gap-3 @xl:grid-cols-2">
                    {stability.map((m) => {
                      const v = str(rp, m.key);
                      if (!v) return null;
                      const pct = ({ poor: 20, weak: 30, fair: 50, medium: 50, good: 70, strong: 80, high: 80, excellent: 95 } as Record<string, number>)[v] ?? 60;
                      const tone = pct >= 75 ? "emerald" : pct >= 50 ? "amber" : "rose";
                      return <BarRow key={m.key} label={m.label} pct={pct} tone={tone} valueText={t("opt." + v, v)} />;
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
                  <Mini label={t("sd.activeRisks", "Active risks")} value={String(openItems)} tone={openItems ? "amber" : "emerald"} />
                  <Mini label={t("sd.highCritical", "High / critical")} value={String(openHigh)} tone={openHigh ? "rose" : "emerald"} />
                  <Mini label={t("sd.backupAvailable", "Backup available")} value={backup ? t("sd.yes", "Yes") : t("sd.no", "No")} tone={backup ? "emerald" : "rose"} />
                  <Mini label={t("sd.assessmentNotes", "Notes")} value={str(rp, "assessment_notes") ? t("sd.yes", "Yes") : "—"} tone={str(rp, "assessment_notes") ? "default" : "default"} />
                </div>
              </div>
            );
          })()}
          <div className="mt-5 pt-5 border-t border-[var(--border-subtle)]">
            <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-faint)] mb-3 flex items-center gap-1.5">
              <ShieldCheckIcon className="h-3 w-3" />
              {t("sd.riskIntelligence", "Risk Intelligence")}
            </div>
            <RiskSection supplierId={id} riskProfile={data.riskProfile ?? null} riskItems={data.riskItems ?? []} risk={data.risk ?? null} onSaved={() => load({ silent: true })} />
          </div>
        </Sec>
        </div>

        {/* Negotiation — one shell: hero overall bar + visual summary + intelligence editor */}
        <div id="negotiation" className="scroll-mt-16">
        <Sec tone="amber" title={t("sd.negotiation", "Negotiation")} icon={<HandshakeIcon className="h-4 w-4" />}>
          {(() => {
            const ni = (data.negotiationIntel ?? {}) as Row;
            const score = num(ni, "negotiation_score");
            const lev: Record<string, number> = { low: 25, medium: 50, high: 80 };
            const bars = [
              { key: "price_flexibility", label: t("sd.priceFlexibility", "Price flexibility") },
              { key: "moq_flexibility", label: t("sd.moqFlexibility", "MOQ flexibility") },
              { key: "payment_flexibility", label: t("sd.paymentFlexibility", "Payment flexibility") },
              { key: "communication_flexibility", label: t("sd.communicationFlexibility", "Communication") },
              { key: "customization_openness", label: t("sd.customizationOpenness", "Customization") },
              { key: "exclusivity_openness", label: t("sd.exclusivityOpenness", "Exclusivity") },
              { key: "leadtime_flexibility", label: t("sd.leadtimeFlexibility", "Lead-time flexibility") },
            ];
            const tactics = Array.isArray(ni.preferred_tactics) ? (ni.preferred_tactics as unknown[]).map(String) : [];
            const leverage = Array.isArray(ni.leverage_points) ? (ni.leverage_points as unknown[]).map(String) : [];
            const negTone: "emerald" | "amber" | "rose" = score >= 70 ? "emerald" : score >= 40 ? "amber" : "rose";
            const negToneRing = negTone === "emerald" ? "ring-emerald-500/30 bg-emerald-500/8" : negTone === "amber" ? "ring-amber-500/30 bg-amber-500/8" : "ring-rose-500/30 bg-rose-500/8";
            const negToneText = negTone === "emerald" ? "text-emerald-600 dark:text-emerald-400" : negTone === "amber" ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400";
            const negToneFill = negTone === "emerald" ? "bg-emerald-500" : negTone === "amber" ? "bg-amber-500" : "bg-rose-500";
            const negLabel = score >= 70 ? t("sd.strong", "Strong") : score >= 40 ? t("sd.moderate", "Moderate") : t("sd.weak", "Weak");
            return (
              <div className="space-y-5">
                {/* Hero overall negotiation rating bar */}
                <div className={`rounded-2xl ring-1 ${negToneRing} px-4 py-4`}>
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-faint)] flex items-center gap-1.5">
                        <HandshakeIcon className="h-3 w-3" />
                        {t("sd.overallNegotiationRating", "Overall negotiation rating")}
                      </div>
                      <div className={`mt-1 text-[11px] font-medium ${negToneText}`}>{negLabel}</div>
                    </div>
                    <div className={`text-3xl font-bold tabular-nums ${negToneText}`}>
                      {Math.round(score) || 0}<span className="text-base font-medium text-[var(--text-faint)]">/100</span>
                    </div>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-surface)]">
                    <div className={`h-full rounded-full ${negToneFill}`} style={{ width: `${Math.max(4, Math.min(100, score || 0))}%` }} />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 @xl:grid-cols-2">
                  {bars.map((b) => {
                    const v = str(ni, b.key);
                    if (!v) return null;
                    const pct = lev[v] ?? 50;
                    return <BarRow key={b.key} label={b.label} pct={pct} tone={pct >= 70 ? "emerald" : pct >= 40 ? "amber" : "rose"} valueText={t("opt." + v, v)} />;
                  })}
                </div>
                <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-3">
                  <Mini label={t("sd.negotiationDifficulty", "Difficulty")} value={str(ni, "negotiation_difficulty") ? t("opt." + str(ni, "negotiation_difficulty"), str(ni, "negotiation_difficulty")) : "—"} tone="default" />
                  <Mini label={t("sd.sampleTurnaround", "Sample turnaround")} value={str(ni, "sample_turnaround_speed") ? t("opt." + str(ni, "sample_turnaround_speed"), str(ni, "sample_turnaround_speed")) : "—"} tone="default" />
                  <Mini label={t("sd.contractWillingness", "Contract willingness")} value={str(ni, "contract_willingness") ? t("opt." + str(ni, "contract_willingness"), str(ni, "contract_willingness")) : "—"} tone="default" />
                </div>
                {(tactics.length || leverage.length) ? (
                  <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2">
                    {tactics.length ? (
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-faint)] mb-2">{t("neg.tacticsLabel", "Tactics:")}</div>
                        <div className="flex flex-wrap gap-1.5">{tactics.map((tg, i) => <span key={i} className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">{tg}</span>)}</div>
                      </div>
                    ) : null}
                    {leverage.length ? (
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-faint)] mb-2">{t("neg.leverageLabel", "Leverage:")}</div>
                        <div className="flex flex-wrap gap-1.5">{leverage.map((lg, i) => <span key={i} className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">{lg}</span>)}</div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {str(ni, "ai_summary") ? <p className="text-sm leading-relaxed text-[var(--text-secondary)]"><AutoTranslatedText text={str(ni, "ai_summary")} /></p> : null}
              </div>
            );
          })()}
          <div className="mt-5 pt-5 border-t border-[var(--border-subtle)]">
            <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-faint)] mb-3 flex items-center gap-1.5">
              <HandshakeIcon className="h-3 w-3" />
              {t("sd.negotiationIntelligence", "Negotiation Intelligence")}
            </div>
            <NegotiationSection supplierId={id} negotiations={data.negotiations ?? []} negotiationIntel={data.negotiationIntel ?? null} onSaved={() => load({ silent: true })} />
          </div>
        </Sec>
        </div>

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

        <GroupLabel>{t("sd.groupRecords", "Records & notes")}</GroupLabel>

        {/* Products supplied */}
        <Section id="products" noBorder>
          <SectionHead eyebrow={t("sd.catalogue", "Catalogue")} title={t("sd.productsSupplied", "Products supplied")} icon={<PackageIcon className="h-4 w-4" />} />
          <div className="mt-4">
            {data.products.length === 0 ? (
              <EmptyTab label={t("sd.noProducts", "No products are linked to this supplier yet.")} />
            ) : (
              <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-3 @4xl:grid-cols-4">
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

        {/* Catalogs (synced from the Catalogs app via the contact link) */}
        <Section id="catalogs">
          <CatalogsSection supplierId={id} />
        </Section>

        {/* Timeline */}
        <Section id="timeline">
          <TimelineSection supplierId={id} timeline={data.timeline ?? []} onSaved={() => load({ silent: true })} />
        </Section>

        {/* Notes */}
        {str(s, "notes") ? (
          <Section id="notes">
            <SectionHead eyebrow={t("sd.records", "Records")} title={t("sd.notes", "Notes")} icon={<DocumentIcon className="h-4 w-4" />} />
            <p className="mt-4 text-sm leading-relaxed text-[var(--text-secondary)]"><AutoTranslatedText text={str(s, "notes")} /></p>
          </Section>
        ) : null}
      </main>
      </div>
    </div>
  );
}

/* ─── Each section is its own SHELL — a rounded, bordered card surface that
   sets the section visually apart on the page. Uppercase mini-title + icon
   (Contacts grammar) sits at the top of the shell. */
const Sec = ({ title, icon, children, tone = "default", action, collapsible = false, collapsed: collapsedProp, onToggle, preview, kxComponent, kxSection, kxRecordId }: { title: string; icon: React.ReactNode; children: React.ReactNode; tone?: "default" | "blue" | "emerald" | "amber" | "rose" | "violet" | "cyan"; action?: React.ReactNode; collapsible?: boolean; collapsed?: boolean; onToggle?: () => void; preview?: React.ReactNode; kxComponent?: string; kxSection?: string; kxRecordId?: string }) => {
  const toneCls: Record<string, string> = {
    default: "bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)]",
    blue: "bg-blue-500/12 text-blue-600 dark:text-blue-400",
    emerald: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
    amber: "bg-amber-500/12 text-amber-700 dark:text-amber-400",
    rose: "bg-rose-500/12 text-rose-600 dark:text-rose-400",
    violet: "bg-violet-500/12 text-violet-600 dark:text-violet-400",
    cyan: "bg-cyan-500/12 text-cyan-600 dark:text-cyan-400",
  };
  // Uncontrolled fallback when collapsible but no controlled state is passed.
  const [localCollapsed, setLocalCollapsed] = useState(false);
  const isControlled = collapsedProp !== undefined;
  const collapsed = collapsible && (isControlled ? collapsedProp : localCollapsed);
  const toggle = () => { if (onToggle) onToggle(); if (!isControlled) setLocalCollapsed((c) => !c); };
  const HeaderTag = collapsible ? "button" : "div";
  return (
    <div
      className="mx-4 md:mx-6 my-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden"
      {...(kxComponent ? kxInspectAttrs({ component: kxComponent, module: "Suppliers", section: kxSection, recordId: kxRecordId }) : {})}
    >
      <HeaderTag
        {...(collapsible ? { type: "button" as const, onClick: toggle, "aria-expanded": !collapsed } : {})}
        className={`flex w-full items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/30 px-4 md:px-5 py-3 text-start ${collapsible ? "cursor-pointer hover:bg-[var(--bg-surface-subtle)]/60 transition-colors" : ""} ${collapsed ? "border-b-transparent" : ""}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${toneCls[tone]}`}>{icon}</span>
          <h3 className="text-[13px] font-semibold tracking-tight text-[var(--text-primary)] truncate">{title}</h3>
          {collapsed && preview ? <span className="ms-1 truncate text-[11px] text-[var(--text-faint)] hidden sm:inline">{preview}</span> : null}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {action ? <div onClick={(e) => e.stopPropagation()}>{action}</div> : null}
          {collapsible ? <AngleDownIcon className={`h-4 w-4 text-[var(--text-faint)] transition-transform ${collapsed ? "-rotate-90 rtl:rotate-90" : ""}`} /> : null}
        </div>
      </HeaderTag>
      {!collapsed ? <div className="px-4 md:px-5 py-4">{children}</div> : null}
    </div>
  );
};

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

/* Horizontal percentage bar with label + value text — used in Risk + Negotiation. */
const BarRow = ({ label, pct, tone = "blue", valueText, big }: { label: string; pct: number; tone?: "blue" | "emerald" | "amber" | "rose" | "violet"; valueText?: string; big?: boolean }) => {
  const fill: Record<string, string> = {
    blue: "bg-[var(--accent,#0066FF)]",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
    violet: "bg-violet-500",
  };
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className={`text-[12px] ${big ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>{label}</span>
        <span className={`text-[12px] tabular-nums ${big ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-faint)]"} capitalize`}>{valueText ?? `${clamped}%`}</span>
      </div>
      <div className={`mt-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-surface-subtle)] ${big ? "h-2.5" : "h-1.5"}`}>
        <div className={`h-full rounded-full ${fill[tone]} transition-[width] duration-300`} style={{ width: `${Math.max(2, clamped)}%` }} />
      </div>
    </div>
  );
};

/* Tiny stat tile used in Risk + Negotiation rows under the bars. */
const Mini = ({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "emerald" | "amber" | "rose" }) => {
  const cls: Record<string, string> = {
    default: "text-[var(--text-primary)]",
    emerald: "text-emerald-600 dark:text-emerald-400",
    amber: "text-amber-700 dark:text-amber-400",
    rose: "text-rose-600 dark:text-rose-400",
  };
  return (
    <div className="rounded-xl bg-[var(--bg-surface-subtle)] px-3 py-2.5">
      <div className={`text-base font-semibold ${cls[tone]} capitalize`}>{value}</div>
      <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-faint)] mt-0.5">{label}</div>
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
